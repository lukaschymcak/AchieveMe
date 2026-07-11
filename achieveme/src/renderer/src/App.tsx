import React, { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'

type Page = 'dashboard' | 'library' | 'settings'

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedAppid, setSelectedAppid] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh(): void {
    setRefreshing(true)
    window.api.refresh().finally(() => setRefreshing(false))
  }

  if (selectedAppid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <nav style={{ padding: '8px 16px', background: '#1a1a22', display: 'flex', gap: 12 }}>
          <button onClick={() => setSelectedAppid(null)}>← Library</button>
        </nav>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <GameDetailPage appid={selectedAppid} onBack={() => setSelectedAppid(null)} />
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{ padding: '8px 16px', background: '#1a1a22', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={() => setPage('dashboard')} style={{ fontWeight: page === 'dashboard' ? 700 : 400 }}>
          Dashboard
        </button>
        <button onClick={() => setPage('library')} style={{ fontWeight: page === 'library' ? 700 : 400 }}>
          Library
        </button>
        <button onClick={() => setPage('settings')} style={{ fontWeight: page === 'settings' ? 700 : 400 }}>
          Settings
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </nav>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'library' && (
          <LibraryPage onSelect={setSelectedAppid} onGoToSettings={() => setPage('settings')} />
        )}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
