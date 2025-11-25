import React, { useState } from 'react'

function pretty(json) {
  try { return JSON.stringify(JSON.parse(json), null, 2) }
  catch { return json }
}

export default function TryIt({ endpoint, baseUrl }) {
  const [base, setBase] = useState(baseUrl || '')
  const [pathParams, setPathParams] = useState(() => {
    const init = {}
    const params = Array.isArray(endpoint.parameters) ? endpoint.parameters : []
    params.forEach(p => { if (p.in === 'path') init[p.name] = p.example || '' })
    return init
  })
  const [query, setQuery] = useState('')
  const [body, setBody] = useState(JSON.stringify(endpoint.requestExample || {}, null, 2))
  const [headers, setHeaders] = useState('')
  const [response, setResponse] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const buildUrl = () => {
    let p = endpoint.path
    Object.keys(pathParams).forEach(k => { p = p.replace(`{${k}}`, encodeURIComponent(pathParams[k] || '')) })
    const q = query ? `?${query}` : ''
    // If base is empty, use absolute path
    return (base ? base.replace(/\/$/, '') : '') + p + q
  }

  async function doTry(e) {
    e && e.preventDefault()
    setLoading(true)
    setResponse(null)
    setStatus(null)
    try {
      const url = buildUrl()
      const hdrs = {}
      headers.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
        const idx = l.indexOf(':')
        if (idx > -1) hdrs[l.slice(0, idx).trim()] = l.slice(idx+1).trim()
      })
      const opts = { method: endpoint.method, headers: hdrs }
      if (['POST','PUT','PATCH'].includes(endpoint.method) && body) {
        const parsed = (() => { try { return JSON.parse(body) } catch { return body } })()
        opts.body = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
        if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json'
      }
      const res = await fetch(url, opts)
      setStatus(`${res.status} ${res.statusText}`)
      const rtext = await res.text()
      // try parse JSON for pretty printing
      try { setResponse(JSON.stringify(JSON.parse(rtext), null, 2)) }
      catch { setResponse(rtext) }
    } catch (err) {
      setResponse(String(err))
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <label className="small">Base URL: </label>
        <input style={{ width: '60%' }} value={base} onChange={e => setBase(e.target.value)} placeholder="https://api.example.com" />
      </div>

      {((Array.isArray(endpoint.parameters) ? endpoint.parameters : [])).filter(p => p.in === 'path').map(p => (
        <div key={p.name} style={{ marginBottom: 6 }}>
          <label className="small">{p.name}: </label>
          <input value={pathParams[p.name] || ''} onChange={e => setPathParams(prev => ({ ...prev, [p.name]: e.target.value }))} />
        </div>
      ))}

      <div style={{ marginBottom: 6 }}>
        <label className="small">Query string (raw): </label>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="limit=5&offset=0" style={{ width: '60%' }} />
      </div>

      <div style={{ marginBottom: 6 }}>
        <label className="small">Headers (one per line `Name: value`):</label>
        <textarea rows={3} value={headers} onChange={e => setHeaders(e.target.value)} style={{ width: '80%' }} />
      </div>

      {['POST','PUT','PATCH'].includes(endpoint.method) && (
        <div style={{ marginBottom: 6 }}>
          <label className="small">Body (JSON):</label>
          <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} style={{ width: '80%' }} />
        </div>
      )}

      <div>
        <button onClick={doTry} disabled={loading}>{loading ? 'Calling...' : 'Try It'}</button>
        <button onClick={() => { setResponse(null); setStatus(null) }} style={{ marginLeft: 8 }}>Clear</button>
      </div>

      {status && <div className="small" style={{ marginTop: 8 }}>Status: {status}</div>}
      {response && <div className="response">{response}</div>}
    </div>
  )
}
