import React from 'react'

export default function EndpointItem({ endpoint, onSelect, selected }) {
  return (
    <div
      className={`sidebar-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 4 }}
    >
      <div className={`method ${endpoint.method}`} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>{endpoint.method}</div>
      <div style={{ fontSize: '12px', flex: 1 }}>{endpoint.summary || endpoint.description || endpoint.path}</div>
    </div>
  )
}
