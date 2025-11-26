import React, { useEffect, useState } from 'react'
import DocsViewer from './components/DocsViewer'
import yaml from 'js-yaml'
import crypto from 'crypto'

// Calculate SHA256 hash of spec for comparison
function calculateSpecHash(spec) {
  const normalized = JSON.stringify(spec, null, 2)
  // Use subtle crypto for browser compatibility
  return JSON.stringify(spec) // Fallback: simple JSON string comparison
}

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
  const [specs, setSpecs] = useState([]) // array of { id, version, timestamp, spec }
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [error, setError] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  // Load default spec on mount
  useEffect(() => {
    fetch('/api-spec.json')
      .then((r) => r.json())
      .then(spec => {
        const newVersion = {
          id: Date.now(),
          version: 'v1.0.0',
          timestamp: new Date().toISOString(),
          spec
        }
        setSpecs([newVersion])
        setSelectedVersionId(newVersion.id)
      })
      .catch((err) => setError(err.message || err))
  }, [])

  // Get current selected spec
  const currentVersion = specs.find(v => v.id === selectedVersionId)
  const currentSpec = currentVersion?.spec

  function handleFileUpload(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result
        let obj = null
        try {
          obj = JSON.parse(text)
        } catch (jsonErr) {
          try {
            obj = yaml.load(text)
          } catch (yamlErr) {
            throw new Error('Failed to parse file as JSON or YAML.')
          }
        }
        
        // Compare with last version
        const lastVersion = specs.length > 0 ? specs[specs.length - 1] : null
        const lastSpecHash = lastVersion ? calculateSpecHash(lastVersion.spec) : null
        const newSpecHash = calculateSpecHash(obj)
        
        if (lastSpecHash && lastSpecHash === newSpecHash) {
          // No changes detected
          setError('No changes detected. This spec is identical to the last version.')
          return
        }
        
        // Generate new version
        const versionNum = specs.length + 1
        const newVersion = {
          id: Date.now(),
          version: `v${versionNum}.0.0`,
          timestamp: new Date().toISOString(),
          spec: obj,
          hasChanges: lastVersion ? true : false
        }
        
        setSpecs(prev => [...prev, newVersion])
        setSelectedVersionId(newVersion.id) // Set as current
        setError(null)
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]')
        if (fileInput) fileInput.value = ''
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
      const text = await res.text()
      let obj = null
      try { obj = JSON.parse(text) }
      catch (jsonErr) {
        try { obj = yaml.load(text) }
        catch (yamlErr) { throw new Error('Failed to parse remote spec as JSON or YAML') }
      }
      
      // Generate new version
      const versionNum = specs.length + 1
      const newVersion = {
        id: Date.now(),
        version: `v${versionNum}.0.0`,
        timestamp: new Date().toISOString(),
        spec: obj
      }
      
      setSpecs(prev => [...prev, newVersion])
      setSelectedVersionId(newVersion.id) // Set as current
    } catch (err) {
      setError(err.message || String(err))
    } finally { setLoadingUrl(false) }
  }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', padding: 20 }}>
      <h1>API Reference — Try It</h1>

      {specs.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
          <label className="small" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select API Version:</label>
          <select 
            value={selectedVersionId || ''} 
            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
            style={{ padding: 8, fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {specs.map(v => (
              <option key={v.id} value={v.id}>
                {v.version} — {new Date(v.timestamp).toLocaleString()} {v.hasChanges ? '🔄 (Updated)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label className="small">Load OpenAPI JSON file: </label>
        <input type="file" accept="application/json,.json,.yaml,.yml" onChange={(e) => handleFileUpload(e.target.files[0])} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="small">Or load from URL: </label>
        <input type="text" placeholder="https://example.com/openapi.json" id="spec-url" style={{ width: '60%' }} />
        <button onClick={() => handleLoadUrl(document.getElementById('spec-url').value)} disabled={loadingUrl} style={{ marginLeft: 8 }}>{loadingUrl ? 'Loading...' : 'Load'}</button>
      </div>

      {specs.length === 0 && !error && <p>Loading API spec...</p>}
      {error && <p style={{ color: 'red' }}>Error loading spec: {error}</p>}
      {currentSpec && <DocsViewer spec={currentSpec} />}
    </div>
  )
}
