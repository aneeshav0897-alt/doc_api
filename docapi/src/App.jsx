import React, { useEffect, useState } from 'react'
import DocsViewer from './components/DocsViewer'

// Minimal OpenAPI (v2/v3) -> internal spec converter
function parseOpenApiSpec(openapi) {
  const info = openapi.info || {}
  const title = info.title || 'API'
  const description = info.description || ''
  const server = (openapi.servers && openapi.servers[0] && openapi.servers[0].url) || openapi.host || ''

  const endpoints = []
  const paths = openapi.paths || {}
  Object.keys(paths).forEach((path) => {
    const methods = paths[path]
    Object.keys(methods).forEach((m) => {
      const op = methods[m]
      const method = m.toUpperCase()
      const parameters = []
      // collect parameters from path level + operation level
      const pathParams = methods.parameters || []
      const opParams = op.parameters || []
      pathParams.concat(opParams).forEach((p) => {
        parameters.push({ name: p.name, in: p.in, example: (p.example || (p.schema && p.schema.example) || '') })
      })

      const requestExample = (op.requestBody && op.requestBody.content && Object.values(op.requestBody.content)[0] && Object.values(op.requestBody.content)[0].example) || null

      endpoints.push({
        method,
        path,
        description: op.summary || op.description || '',
        parameters,
        requestExample
      })
    })
  })

  return { title, description, server, endpoints }
}

export default function App() {
  const [spec, setSpec] = useState(null)
  const [error, setError] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  useEffect(() => {
    fetch('/api-spec.json')
      .then((r) => r.json())
      .then(setSpec)
      .catch((err) => setError(err.message || err))
  }, [])

  function handleFileUpload(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        // try JSON parse, else attempt YAML parse by using a lightweight fallback
        const text = reader.result
        let obj = null
        try { obj = JSON.parse(text) } catch {
          // attempt to parse YAML if js-yaml is not available: crude conversion
          // Replace leading tabs and convert to JSON via regex is unreliable; instruct user to provide JSON if parse fails.
          throw new Error('Failed to parse file as JSON. Provide OpenAPI JSON for now.')
        }
        const parsed = parseOpenApiSpec(obj)
        setSpec(parsed)
        setError(null)
      } catch (err) {
        setError(err.message || String(err))
      }
    }
    reader.readAsText(file)
  }

  async function handleLoadUrl(url) {
    if (!url) return
    try {
      setLoadingUrl(true)
      setError(null)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`)
      const obj = await res.json()
      const parsed = parseOpenApiSpec(obj)
      setSpec(parsed)
    } catch (err) {
      setError(err.message || String(err))
    } finally { setLoadingUrl(false) }
  }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', padding: 20 }}>
      <h1>API Reference — Try It</h1>

      <div style={{ marginBottom: 12 }}>
        <label className="small">Load OpenAPI JSON file: </label>
        <input type="file" accept="application/json" onChange={(e) => handleFileUpload(e.target.files[0])} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="small">Or load from URL: </label>
        <input type="text" placeholder="https://example.com/openapi.json" id="spec-url" style={{ width: '60%' }} />
        <button onClick={() => handleLoadUrl(document.getElementById('spec-url').value)} disabled={loadingUrl} style={{ marginLeft: 8 }}>{loadingUrl ? 'Loading...' : 'Load'}</button>
      </div>

      {!spec && !error && <p>Loading API spec...</p>}
      {error && <p style={{ color: 'red' }}>Error loading spec: {error}</p>}
      {spec && <DocsViewer spec={spec} />}
    </div>
  )
}
