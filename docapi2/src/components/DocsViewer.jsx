import React, { useMemo, useState, useEffect, useRef } from 'react'
import EndpointItem from './EndpointItem'
import TryIt from './TryIt'
import { genCurl, genFetch, genPythonRequests, genAxios, genRuby, genPHP, genGo, genJava, genCSharp } from '../utils/codegen'

function groupByTag(endpoints) {
  const map = new Map()
  endpoints.forEach(ep => {
    const tag = (ep.tags && ep.tags[0]) || 'General'
    if (!map.has(tag)) map.set(tag, [])
    map.get(tag).push(ep)
  })
  return Array.from(map.entries())
}

export default function DocsViewer({ spec }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [loadedSpec, setLoadedSpec] = useState(null)
  const [specLoadError, setSpecLoadError] = useState('')
  const [specLoading, setSpecLoading] = useState(false)
  const [language, setLanguage] = useState('curl')
  const [credentialHeader, setCredentialHeader] = useState('')
  const [pathParams, setPathParams] = useState({})
  const [queryString, setQueryString] = useState('')
  const [reqHeaders, setReqHeaders] = useState('')
  const [reqBody, setReqBody] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [selectedContent, setSelectedContent] = useState(null) // 'title' or endpoint

  // resizable columns
  const [leftWidth, setLeftWidth] = useState(280)
  const [rightWidth, setRightWidth] = useState(360)
  const dragState = React.useRef({ dragging: null, startX: 0, startLeft: 280, startRight: 360 })

  const minLeft = 160, maxLeft = 800, minRight = 160, maxRight = 900

  function onMouseDownLeft(e) {
    e.preventDefault()
    dragState.current = { dragging: 'left', startX: e.clientX, startLeft: leftWidth }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseDownRight(e) {
    e.preventDefault()
    dragState.current = { dragging: 'right', startX: e.clientX, startRight: rightWidth }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e) {
    const st = dragState.current
    if (!st.dragging) return
    const dx = e.clientX - st.startX
    if (st.dragging === 'left') {
      const nw = Math.min(maxLeft, Math.max(minLeft, st.startLeft + dx))
      setLeftWidth(nw)
    } else if (st.dragging === 'right') {
      const nw = Math.min(maxRight, Math.max(minRight, st.startRight - dx))
      setRightWidth(nw)
    }
  }

  function onMouseUp() {
    dragState.current.dragging = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  // responsive/mobile toggles
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth <= 1000 : false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)

  React.useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 1000
      setIsMobile(mobile)
      if (mobile) {
        setSidebarOpen(false)
        setRightOpen(false)
      } else {
        setSidebarOpen(true)
        setRightOpen(true)
      }
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const effectiveSpec = spec || loadedSpec || {}

  // Convert Swagger/OpenAPI JSON into a simple endpoints[] format the UI expects
  function parseSpec(s) {
    if (!s) return { endpoints: [], server: '' }
    // Swagger 2.0
    const endpoints = []
    const paths = s.paths || {}
    for (const p in paths) {
      const item = paths[p]
      for (const methodRaw in item) {
        const methodLower = methodRaw.toUpperCase()
        const op = item[methodRaw]
        
        // Extract request/response examples and error codes
        let requestExample = null
        let responseExamples = []
        let errorCodes = []
        
        // Extract request body example
        if (op.requestBody && op.requestBody.content) {
          const first = Object.values(op.requestBody.content)[0]
          if (first && first.example) {
            requestExample = first.example
          } else if (first && first.schema) {
            requestExample = first.schema.example || first.schema
          }
        }
        
        // Swagger 2.0 body param
        const bodyParam = (op.parameters || []).find(p => p.in === 'body')
        if (bodyParam && bodyParam.schema) {
          requestExample = requestExample || bodyParam.schema.example || bodyParam.schema
        }
        
        // Extract response examples and error codes
        const responses = op.responses || {}
        for (const statusCode in responses) {
          const respObj = responses[statusCode]
          
          // Track error codes (4xx, 5xx)
          if (statusCode.match(/^[45]\d{2}$/)) {
            errorCodes.push({
              code: statusCode,
              description: respObj.description || ''
            })
          }
          
          // Extract response example
          if (respObj.content) {
            const contentType = Object.keys(respObj.content)[0]
            const content = respObj.content[contentType]
            if (content && content.example) {
              responseExamples.push({
                statusCode,
                description: respObj.description || '',
                example: content.example
              })
            } else if (content && content.schema && content.schema.example) {
              responseExamples.push({
                statusCode,
                description: respObj.description || '',
                example: content.schema.example
              })
            }
          }
          
          // OpenAPI 3 response examples in headers/description
          if (!responseExamples.find(r => r.statusCode === statusCode) && respObj.description) {
            responseExamples.push({
              statusCode,
              description: respObj.description || '',
              example: null
            })
          }
        }
        
        const ep = {
          path: p,
          method: methodLower,
          summary: op.summary || op.operationId || '',
          description: op.description || '',
          parameters: op.parameters || [],
          responses: op.responses || {},
          tags: op.tags || (op.tag ? [op.tag] : ['General']),
          requestExample,
          responseExamples,
          errorCodes
        }
        endpoints.push(ep)
      }
    }

    // determine server/base url
    let server = ''
    if (s.swagger) {
      // swagger 2.0
      const scheme = Array.isArray(s.schemes) && s.schemes[0] ? s.schemes[0] : 'https'
      const host = s.host || ''
      const basePath = s.basePath || ''
      if (host) server = `${scheme}://${host}${basePath}`
    } else if (s.openapi) {
      // openapi 3.x
      if (Array.isArray(s.servers) && s.servers[0] && s.servers[0].url) server = s.servers[0].url
    }

    return { endpoints, server }
  }

  const processed = parseSpec(effectiveSpec)
  const endpoints = processed.endpoints || []

  const [recentRequests, setRecentRequests] = useState([])
  const [selectedRecentIndex, setSelectedRecentIndex] = useState(null)

  function handleTryItResult(r) {
    setRecentRequests(prev => {
      const next = [r, ...prev]
      return next.slice(0, 50)
    })
    setSelectedRecentIndex(0)
  }

  useEffect(() => {
    if (!selected && endpoints.length > 0) {
      setSelected(endpoints[0])
      setSelectedContent('endpoint') // Auto-show first endpoint
    }
  }, [endpoints, selected])

  // Reset state when spec changes (new upload)
  useEffect(() => {
    setQuery('')
    setSelected(null)
    setPathParams({})
    setQueryString('')
    setReqHeaders('')
    setReqBody('')
    setLanguage('curl')
    setCredentialHeader('')
    setRecentRequests([])
    setSelectedRecentIndex(null)
    setCopyStatus('')
    setSelectedContent(null)
  }, [spec])

  // Load api-spec.json from project root when no spec prop provided
  useEffect(() => {
    if (spec) return
    let mounted = true
    setSpecLoading(true)
    fetch('/api-spec.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }).then(data => {
      if (!mounted) return
      setLoadedSpec(data)
      setSpecLoading(false)
      setSpecLoadError('')
      const pr = parseSpec(data)
      if (pr.server) setBaseUrl(pr.server)
    }).catch(err => {
      if (!mounted) return
      setSpecLoadError(String(err))
      setSpecLoading(false)
    })
    return () => { mounted = false }
  }, [spec])

  function reloadSpec() {
    setLoadedSpec(null)
    setSpecLoadError('')
    setSpecLoading(true)
    fetch('/api-spec.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }).then(data => {
      setLoadedSpec(data)
      setSpecLoading(false)
      const pr = parseSpec(data)
      if (pr.server) setBaseUrl(pr.server)
    }).catch(err => {
      setSpecLoadError(String(err))
      setSpecLoading(false)
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return endpoints
    return endpoints.filter(ep => {
      return (
        (ep.path && ep.path.toLowerCase().includes(q)) ||
        (ep.description && ep.description.toLowerCase().includes(q)) ||
        (ep.method && ep.method.toLowerCase().includes(q))
      )
    })
  }, [query, endpoints])

  const groups = groupByTag(filtered)
  const [expandedTags, setExpandedTags] = useState({})

  function toggleGroup(tag) {
    setExpandedTags(prev => ({ ...prev, [tag]: !prev[tag] }))
  }

  // initialize parameter/body state when selected endpoint changes
  React.useEffect(() => {
    if (!selected) return
    const initPath = {}
    const params = Array.isArray(selected.parameters) ? selected.parameters : []
    params.forEach(p => { if (p.in === 'path') initPath[p.name] = p.example || '' })
    setPathParams(initPath)
    setQueryString('')
    setReqHeaders('')
    try { setReqBody(JSON.stringify(selected.requestExample || {}, null, 2)) } catch { setReqBody('') }
  }, [selected])

  const codeFor = (ep) => {
    const e = { ...ep }
    e._exampleHeaders = e._exampleHeaders || {}
    if (credentialHeader) {
      if (credentialHeader.includes(':')) {
        const idx = credentialHeader.indexOf(':')
        e._exampleHeaders[credentialHeader.slice(0, idx).trim()] = credentialHeader.slice(idx+1).trim()
      } else {
        e._exampleHeaders['Authorization'] = credentialHeader.trim()
      }
    }
    return {
      curl: genCurl(baseUrl, e),
      fetch: genFetch(baseUrl, e),
      python: genPythonRequests(baseUrl, e),
      axios: genAxios(baseUrl, e),
      ruby: genRuby(baseUrl, e),
      php: genPHP(baseUrl, e),
      go: genGo(baseUrl, e),
      java: genJava(baseUrl, e),
      csharp: genCSharp(baseUrl, e)
    }
  }

  async function copy(text) {
    if (!text) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // fallback for insecure contexts or older browsers
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(''), 1500)
    } catch (e) {
      console.warn('copy failed', e)
      setCopyStatus('failed')
      setTimeout(() => setCopyStatus(''), 1500)
    }
  }

  const langCodeMap = { curl: 'curl', fetch: 'fetch', python: 'python', axios: 'axios', ruby: 'ruby', php: 'php', go: 'go', java: 'java', csharp: 'csharp' }
  const currentCode = selected ? codeFor(selected)[langCodeMap[language]] : ''

  const gridStyle = isMobile ? { gridTemplateColumns: '1fr' } : { gridTemplateColumns: `${leftWidth}px 6px 1fr 6px ${rightWidth}px` }

  return (
    <div className="docs-layout" style={gridStyle}>
      <aside className="docs-sidebar" style={{ display: isMobile && !sidebarOpen ? 'none' : undefined }}>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>JUMP TO</strong>
            <span className="small">CTRL-/</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <input placeholder="Search endpoints" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div className="sidebar-list">
          {/* API Title Link */}
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '12px',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              backgroundColor: selectedContent === 'title' ? '#f0f0f0' : 'transparent',
              borderRadius: '4px',
              fontWeight: 'bold',
              color: '#0066cc'
            }}
            onClick={() => setSelectedContent('title')}
            title="View API Overview"
          >
            # {effectiveSpec.info?.title || 'API Overview'}
          </div>

          {groups.map(([tag, eps]) => {
            const isOpen = !!expandedTags[tag]
            return (
              <div key={tag} className="sidebar-group">
                <div
                  className="small sidebar-group-title"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleGroup(tag)}
                >
                  <span>{tag}</span>
                  <span style={{ opacity: 0.7 }}>{isOpen ? '▾' : '▸'}</span>
                </div>
                {isOpen && eps.map((ep, i) => (
                  <EndpointItem key={i} endpoint={ep} selected={selected === ep} onSelect={() => { setSelected(ep); setSelectedContent('endpoint'); }} />
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      <div className="resizer left-resizer" onMouseDown={onMouseDownLeft} style={{ display: isMobile ? 'none' : undefined }} />

      <main className="docs-main">
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setSidebarOpen(s => !s)} style={{ padding: '6px 10px' }}>☰</button>
            <button onClick={() => setRightOpen(s => !s)} style={{ padding: '6px 10px' }}>▣</button>
            <div style={{ flex: 1 }} />
            <input placeholder="Search endpoints" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 160, padding: 6 }} />
          </div>
        )}
        {specLoading && <div style={{ padding: 20 }}>Loading API spec...</div>}
        {specLoadError && (
          <div style={{ padding: 20 }}>
            <div style={{ color: '#a00', marginBottom: 8 }}>Failed to load `api-spec.json`: {specLoadError}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reloadSpec} style={{ padding: '6px 12px' }}>Retry</button>
              <div className="small" style={{ color: '#666' }}>Ensure the file `api-spec.json` is served from the dev server root.</div>
            </div>
          </div>
        )}
        {!specLoading && !specLoadError && !selected && !selectedContent && <div style={{ padding: 20 }}>Pick an endpoint from the left</div>}
        {selectedContent === 'title' && (
          <div style={{ padding: 20 }}>
            <h1 style={{ margin: 0 }}># {effectiveSpec.info?.title || 'API'}</h1>
            <p style={{ color: '#666', marginTop: 12 }}>{effectiveSpec.info?.description || 'No description'}</p>
            {effectiveSpec.info?.version && (
              <div style={{ marginTop: 12, fontSize: 14 }}>
                <strong>Version:</strong> {effectiveSpec.info.version}
              </div>
            )}
            {effectiveSpec.info?.contact?.email && (
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <strong>Contact:</strong> {effectiveSpec.info.contact.email}
              </div>
            )}
            {effectiveSpec.info?.license?.name && (
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <strong>License:</strong> {effectiveSpec.info.license.name}
              </div>
            )}
          </div>
        )}
        {selected && selectedContent === 'endpoint' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div className={`method ${selected.method}`} style={{ fontSize: 16, padding: '4px 10px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{selected.method}</div>
              <div>
                <h2 style={{ margin: 0, marginBottom: 4 }}>{selected.path}</h2>
                <h3 style={{ margin: 0, color: '#666', fontWeight: 'normal', fontSize: 18 }}>{selected.summary || selected.description}</h3>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8, color: '#666', marginBottom: 16 }}>Full URL: {(baseUrl || processed.server || '') + selected.path}</div>
            {selected.description && (
              <p style={{ marginTop: 12, marginBottom: 16, lineHeight: 1.6 }}>{selected.description}</p>
            )}

            {/* Sample Request */}
            {selected.requestExample && (
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f7fa', borderRadius: 4 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Sample Request Body</h4>
                <pre style={{ maxHeight: 200, overflow: 'auto', padding: 8, background: '#fff', borderRadius: 3, fontSize: 12 }}>
                  {typeof selected.requestExample === 'string' ? selected.requestExample : JSON.stringify(selected.requestExample, null, 2)}
                </pre>
              </div>
            )}

            {/* Sample Responses */}
            {selected.responseExamples && selected.responseExamples.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f7fa', borderRadius: 4 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Sample Responses</h4>
                {selected.responseExamples.map((resp, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 8, backgroundColor: '#fff', borderRadius: 3, borderLeft: `4px solid ${resp.statusCode.startsWith('2') ? '#28a745' : resp.statusCode.startsWith('4') ? '#ffc107' : '#dc3545'}` }}>
                    <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                      Status {resp.statusCode}: {resp.description}
                    </div>
                    {resp.example && (
                      <pre style={{ maxHeight: 150, overflow: 'auto', padding: 6, background: '#f9f9f9', borderRadius: 2, fontSize: 11, margin: 0 }}>
                        {typeof resp.example === 'string' ? resp.example : JSON.stringify(resp.example, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Error Codes */}
            {selected.errorCodes && selected.errorCodes.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff3cd', borderRadius: 4 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Error Codes & Responses</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: 6, fontSize: 12, fontWeight: 600 }}>Code</th>
                      <th style={{ textAlign: 'left', padding: 6, fontSize: 12, fontWeight: 600 }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.errorCodes.map((err, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 6, fontSize: 12, fontWeight: 600 }}>{err.code}</td>
                        <td style={{ padding: 6, fontSize: 12 }}>{err.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <h3>Parameters & Request</h3>
              <div style={{ marginTop: 8 }}>
                {((Array.isArray(selected.parameters) ? selected.parameters : [])).filter(p => p.in === 'path').map(p => (
                  <div key={p.name} style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'start' }}>
                    <label className="small" style={{ fontWeight: 600 }}>{p.name}:</label>
                    <div>
                      <input value={pathParams[p.name] || ''} onChange={e => setPathParams(prev => ({ ...prev, [p.name]: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 3 }} />
                      <div className="small" style={{ color: '#666', marginTop: 4 }}>{p.description}</div>
                    </div>
                  </div>
                ))}

                <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'start' }}>
                  <label className="small" style={{ fontWeight: 600 }}>Query String:</label>
                  <input value={queryString} onChange={e => setQueryString(e.target.value)} placeholder="limit=5&offset=0" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 3 }} />
                </div>

                <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'start' }}>
                  <label className="small" style={{ fontWeight: 600 }}>Headers:</label>
                  <textarea rows={3} value={reqHeaders} onChange={e => setReqHeaders(e.target.value)} placeholder="Authorization: Bearer token&#10;Content-Type: application/json" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }} />
                </div>

                {['POST','PUT','PATCH'].includes(selected.method) && (
                  <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'start' }}>
                    <label className="small" style={{ fontWeight: 600 }}>Body (JSON):</label>
                    <textarea rows={8} value={reqBody} onChange={e => setReqBody(e.target.value)} style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }} />
                  </div>
                )}
              </div>

              <div className="recent-grid" style={{ marginTop: 16 }}>
                <div>
                  <h3>Recent Requests</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: 8 }} className="small">TIME</th>
                        <th style={{ textAlign: 'left', padding: 8 }} className="small">STATUS</th>
                        <th style={{ textAlign: 'left', padding: 8 }} className="small">USER AGENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRequests.length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: 12, textAlign: 'center', color: '#999' }} className="small">Make a request to see history.</td>
                        </tr>
                      )}
                      {recentRequests.map((r, i) => (
                        <tr key={r.time + '|' + i} onClick={() => setSelectedRecentIndex(i)} style={{ cursor: 'pointer', background: selectedRecentIndex === i ? '#f5f7fb' : undefined }}>
                          <td style={{ padding: 8 }} className="small">{new Date(r.time).toLocaleString()}</td>
                          <td style={{ padding: 8 }} className="small">{r.status ? `${r.status} ${r.statusText || ''}` : (r.statusText || 'Error')}</td>
                          <td style={{ padding: 8 }} className="small">{(r.userAgent || '').slice(0, 60)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3>Response</h3>
                  {selectedRecentIndex == null || !recentRequests[selectedRecentIndex] ? (
                    <div className="response-placeholder small">Response examples will appear here after try-it.</div>
                  ) : (
                    (() => {
                      const item = recentRequests[selectedRecentIndex]
                      return (
                        <div>
                          <div className="small" style={{ marginBottom: 8 }}><strong>Status:</strong> {item.status ? `${item.status} ${item.statusText || ''}` : item.statusText}</div>
                          <div className="small" style={{ marginBottom: 8 }}><strong>Request:</strong> {item.method} {item.url}</div>
                          <div className="small" style={{ marginBottom: 8 }}><strong>Headers:</strong></div>
                          <pre style={{ maxHeight: 160, overflow: 'auto', padding: 8, background: '#f7f7f9' }}>{JSON.stringify(item.requestHeaders || {}, null, 2)}</pre>
                          {item.requestBody && (
                            <div>
                              <div className="small" style={{ marginTop: 8 }}><strong>Request Body:</strong></div>
                              <pre style={{ maxHeight: 160, overflow: 'auto', padding: 8, background: '#f7f7f9' }}>{typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody, null, 2)}</pre>
                            </div>
                          )}
                          <div className="small" style={{ marginTop: 8 }}><strong>Response Body:</strong></div>
                          <pre style={{ maxHeight: 360, overflow: 'auto', padding: 8, background: '#fff' }}>{item.responseText}</pre>
                        </div>
                      )
                    })()
                  )}
                </div>
              </div>
          </div>
          </div>
        )}
      </main>

      <div className="resizer right-resizer" onMouseDown={onMouseDownRight} style={{ display: isMobile ? 'none' : undefined }} />

      <aside className="docs-right" style={{ display: isMobile && !rightOpen ? 'none' : undefined }}>
        <div style={{ padding: 16 }}>
          <div className="small" style={{ color: '#666', fontWeight: 600 }}>LANGUAGE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
            <button className={`lang-btn ${language === 'curl' ? 'active' : ''}`} onClick={() => setLanguage('curl')}>Shell</button>
            <button className={`lang-btn ${language === 'fetch' ? 'active' : ''}`} onClick={() => setLanguage('fetch')}>Node</button>
            <button className={`lang-btn ${language === 'python' ? 'active' : ''}`} onClick={() => setLanguage('python')}>Ruby</button>
            <button className={`lang-btn ${language === 'axios' ? 'active' : ''}`} onClick={() => setLanguage('axios')}>PHP</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="curl">Shell (curl)</option>
              <option value="fetch">JavaScript (fetch)</option>
              <option value="python">Python (requests)</option>
              <option value="axios">JavaScript (axios)</option>
              <option value="ruby">Ruby</option>
              <option value="php">PHP</option>
              <option value="go">Go</option>
              <option value="java">Java</option>
              <option value="csharp">C# (HttpClient)</option>
            </select>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ color: '#666', fontWeight: 600, marginBottom: 8 }}>CREDENTIALS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 30px', gap: 8, alignItems: 'center' }}>
              <span className="small">Header</span>
              <input placeholder="api_key" value={credentialHeader} onChange={e => setCredentialHeader(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 3 }} />
              <span style={{ cursor: 'pointer', textAlign: 'center' }}>🔐</span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ color: '#666', fontWeight: 600, marginBottom: 8 }}>BASE URL</div>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 3 }} />
          </div>
          {selected && (
            <div style={{ marginTop: 16 }}>
              <div className="code-block-header">cURL Request</div>
              <pre className="response" style={{ marginTop: 8, fontSize: '12px', lineHeight: 1.4 }}>{currentCode}</pre>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => copy(currentCode)} style={{ padding: '6px 12px', fontSize: '12px' }}>{copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Failed' : 'Copy'}</button>
                <TryIt endpoint={selected} baseUrl={baseUrl || processed.server || ''} pathParams={pathParams} query={queryString} headers={reqHeaders} body={reqBody} onResult={handleTryItResult} />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
