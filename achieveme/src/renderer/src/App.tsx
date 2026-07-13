import React, { useEffect, useState } from 'react'
import type { GameSummary } from '../../shared/types'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'

type Page = 'dashboard' | 'library' | 'settings'
type TransitionDir = 'next' | 'prev' | null

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedAppid, setSelectedAppid] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [libraryGames, setLibraryGames] = useState<GameSummary[]>([])
  const [transitionDir, setTransitionDir] = useState<TransitionDir>(null)

  function handleRefresh(): void {
    setRefreshing(true)
    window.api.refresh().finally(() => setRefreshing(false))
  }

  useEffect(() => {
    function handleLibraryUpdated(): void {
      window.api.getAllGames().then(setLibraryGames)
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [])

  if (selectedAppid) {
    const currentIdx = libraryGames.findIndex((g) => g.appid === selectedAppid)
    const prevAppid = currentIdx > 0 ? libraryGames[currentIdx - 1].appid : null
    const nextAppid =
      currentIdx >= 0 && currentIdx < libraryGames.length - 1
        ? libraryGames[currentIdx + 1].appid
        : null

    return (
      <div className="app-shell app-shell--game-detail">
        <main className="app-main">
          <GameDetailPage
            appid={selectedAppid}
            transitionDir={transitionDir}
            onBack={() => {
              setTransitionDir(null)
              setSelectedAppid(null)
            }}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onPrev={
              prevAppid
                ? () => {
                    setTransitionDir('prev')
                    setSelectedAppid(prevAppid)
                  }
                : null
            }
            onNext={
              nextAppid
                ? () => {
                    setTransitionDir('next')
                    setSelectedAppid(nextAppid)
                  }
                : null
            }
          />
        </main>
      </div>
    )
  }

  if (page === 'library') {
    return (
      <div className="app-shell">
        <main className="app-main">
          <LibraryPage
            page={page}
            onNavigate={setPage}
            onSelect={setSelectedAppid}
            onGoToSettings={() => setPage('settings')}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onDisplayedGamesChange={setLibraryGames}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav__link${page === 'dashboard' ? ' app-nav__link--active' : ''}`}
          onClick={() => setPage('dashboard')}
        >
          Dashboard
        </button>
        <button type="button" className="app-nav__link" onClick={() => setPage('library')}>
          Library
        </button>
        <button
          type="button"
          className={`app-nav__link${page === 'settings' ? ' app-nav__link--active' : ''}`}
          onClick={() => setPage('settings')}
        >
          Settings
        </button>
      </nav>
      <main className="app-main">
        {page === 'dashboard' && <DashboardPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
