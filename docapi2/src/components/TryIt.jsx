import React, { useState } from 'react'

export default function TryIt({ endpoint, baseUrl, pathParams = {}, query = '', headers = '', body = '', onResult }) {
  const [response, setResponse] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const buildUrl = () => {
    let p = endpoint.path
    Object.keys(pathParams).forEach(k => { p = p.replace(`{${k}}`, encodeURIComponent(pathParams[k] || '')) })
    const q = query ? `?${query}` : ''
    return (baseUrl ? baseUrl.replace(/\/$/, '') : '') + p + q
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
      let res = null
      let rtext = ''
      try {
        res = await fetch(url, opts)
        setStatus(`${res.status} ${res.statusText}`)
        rtext = await res.text()
        try { setResponse(JSON.stringify(JSON.parse(rtext), null, 2)) }
        catch { setResponse(rtext) }
      } finally {
        // call onResult with a standardized object
        if (typeof onResult === 'function') {
          try {
            onResult({
              time: new Date().toISOString(),
              method: endpoint.method,
              url,
              status: res ? res.status : null,
              statusText: res ? res.statusText : null,
              ok: res ? res.ok : false,
              userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',
              requestHeaders: hdrs,
              requestBody: opts.body || null,
              responseText: rtext
            })
          } catch (err) {
            console.warn('onResult callback failed', err)
          }
        }
      }
    } catch (err) {
      setResponse(String(err))
      if (typeof onResult === 'function') {
        try {
          onResult({ time: new Date().toISOString(), method: endpoint.method, url: buildUrl(), status: null, statusText: String(err), ok: false, userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '', requestHeaders: {}, requestBody: body || null, responseText: String(err) })
        } catch (e) { /* ignore */ }
      }
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div>
        <button onClick={doTry} disabled={loading}>{loading ? 'Calling...' : 'Try It'}</button>
        <button onClick={() => { setResponse(null); setStatus(null) }} style={{ marginLeft: 8 }}>Clear</button>
      </div>

      {status && <div className="small" style={{ marginTop: 8 }}>Status: {status}</div>}
      {response && <div className="response">{response}</div>}
    </div>
  )
}
