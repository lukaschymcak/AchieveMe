import React, { useState } from 'react'

type Page = 'dashboard' | 'library' | 'settings'

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{ padding: '8px 16px', background: '#1a1a22', display: 'flex', gap: 12 }}>
        <button onClick={() => setPage('dashboard')}>Dashboard</button>
        <button onClick={() => setPage('library')}>Library</button>
        <button onClick={() => setPage('settings')}>Settings</button>
      </nav>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {page === 'dashboard' && <div style={{ padding: 24 }}>Dashboard — built in PLAN-04</div>}
        {page === 'library' && <div style={{ padding: 24 }}>Library — built in PLAN-04</div>}
        {page === 'settings' && <div style={{ padding: 24 }}>Settings — built in PLAN-04</div>}
      </main>
    </div>
  )
}
