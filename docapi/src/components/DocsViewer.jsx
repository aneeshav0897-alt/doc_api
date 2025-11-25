import React, { useMemo, useState } from 'react'
import EndpointItem from './EndpointItem'
import TryIt from './TryIt'
import { genCurl, genFetch, genPythonRequests, genAxios, genRuby, genPHP, genGo, genJava } from '../utils/codegen'

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
  const [baseUrl, setBaseUrl] = useState(spec.server || '')
  const [language, setLanguage] = useState('curl')
  const [credentialHeader, setCredentialHeader] = useState('')

  const endpoints = spec.endpoints || []

  useMemo(() => {
    if (!selected && endpoints.length > 0) setSelected(endpoints[0])
  }, [endpoints, selected])

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
      java: genJava(baseUrl, e)
    }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text) } catch (e) { console.warn('copy failed', e) }
  }

  const langCodeMap = { curl: 'curl', fetch: 'fetch', python: 'python', axios: 'axios', ruby: 'ruby', php: 'php', go: 'go', java: 'java' }
  const currentCode = selected ? codeFor(selected)[langCodeMap[language]] : ''

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
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
          {groups.map(([tag, eps]) => (
            <div key={tag} className="sidebar-group">
              <div className="small sidebar-group-title">{tag}</div>
              {eps.map((ep, i) => (
                <EndpointItem key={i} endpoint={ep} selected={selected === ep} onSelect={() => setSelected(ep)} />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="docs-main">
        {!selected && <div style={{ padding: 20 }}>Pick an endpoint from the left</div>}
        {selected && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={`method ${selected.method}`}>{selected.method}</div>
              <h1 style={{ margin: 0 }}>{selected.summary || selected.description || selected.path}</h1>
            </div>
            <div className="small" style={{ marginTop: 8, color: '#666' }}>{(baseUrl || spec.server) + selected.path}</div>
            <p style={{ marginTop: 12 }}>{selected.description}</p>
            <div style={{ marginTop: 20 }}>
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
                  <tr>
                    <td colSpan="3" style={{ padding: 12, textAlign: 'center', color: '#999' }} className="small">Make a request to see history.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 20 }}>
              <h3>Response</h3>
              <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4, color: '#999' }} className="small">Response examples will appear here after try-it.</div>
            </div>
          </div>
        )}
      </main>

      <aside className="docs-right">
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
            </select>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ color: '#666', fontWeight: 600 }}>CREDENTIALS</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="small">Header</span>
              <input placeholder="api_key" value={credentialHeader} onChange={e => setCredentialHeader(e.target.value)} style={{ flex: 1, padding: 6 }} />
              <span style={{ cursor: 'pointer' }}>🔐</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ color: '#666', fontWeight: 600 }}>URL</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select style={{ padding: 6 }}>
                <option>Base URL</option>
              </select>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} style={{ flex: 1, padding: 6 }} />
            </div>
          </div>
          {selected && (
            <div style={{ marginTop: 16 }}>
              <div className="code-block-header">cURL Request</div>
              <pre className="response" style={{ marginTop: 8, fontSize: '12px', lineHeight: 1.4 }}>{currentCode}</pre>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => copy(currentCode)} style={{ padding: '6px 12px', fontSize: '12px' }}>Copy</button>
                <TryIt endpoint={selected} baseUrl={baseUrl || spec.server} />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
