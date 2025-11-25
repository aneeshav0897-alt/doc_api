import React from 'react'

export default function EndpointItem({ endpoint, onSelect, selected }) {
  return (
    <div
      className={`sidebar-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer', borderRadius: 4 }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
        <div className={`method ${endpoint.method}`} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>{endpoint.method}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{endpoint.path}</div>
      </div>
      <div className="small" style={{ fontSize: '11px', color: '#999', marginLeft: 8 }}>{endpoint.summary || ''}</div>
    </div>
  )
}
