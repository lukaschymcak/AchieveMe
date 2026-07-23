import React, { useEffect, useState } from 'react'
import type { GameSummary, SessionRecapPayload } from '../../shared/types'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import HelpPage from './pages/HelpPage'
import FirstRunWelcome from './components/FirstRunWelcome'
import SessionRecapModal from './components/SessionRecapModal'
import { shouldShowFirstRun } from './lib/helpStorage'

type Page = 'dashboard' | 'library' | 'settings' | 'help'
type TransitionDir = 'next' | 'prev' | null

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedAppid, setSelectedAppid] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [libraryGames, setLibraryGames] = useState<GameSummary[]>([])
  const [transitionDir, setTransitionDir] = useState<TransitionDir>(null)
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun())
  const [sessionRecap, setSessionRecap] = useState<SessionRecapPayload | null>(null)

  function handleRefresh(): void {
    setRefreshing(true)
    window.api.refresh().finally(() => setRefreshing(false))
  }

  function dismissSessionRecap(): void {
    setSessionRecap(null)
    window.api.sessionRecapDone()
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

  useEffect(() => {
    function handleNavigateToGame(appid: string): void {
      setPage('library')
      setTransitionDir(null)
      setSelectedAppid(appid)
    }

    window.api.onNavigateToGame(handleNavigateToGame)
    return () => {
      window.api.offNavigateToGame(handleNavigateToGame)
    }
  }, [])

  useEffect(() => {
    function handleSessionRecap(payload: SessionRecapPayload): void {
      setSessionRecap(payload)
    }

    window.api.onSessionRecap(handleSessionRecap)
    return () => {
      window.api.offSessionRecap(handleSessionRecap)
    }
  }, [])

  const recapOverlay = sessionRecap ? (
    <SessionRecapModal payload={sessionRecap} onDismiss={dismissSessionRecap} />
  ) : null

  if (selectedAppid) {
    const currentIdx = libraryGames.findIndex((g) => g.appid === selectedAppid)
    const prevAppid = currentIdx > 0 ? libraryGames[currentIdx - 1].appid : null
    const nextAppid =
      currentIdx >= 0 && currentIdx < libraryGames.length - 1
        ? libraryGames[currentIdx + 1].appid
        : null

    return (
      <>
        {recapOverlay}
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
      </>
    )
  }

  if (page === 'library') {
    return (
      <>
        {recapOverlay}
        {showFirstRun && <FirstRunWelcome onDismiss={() => setShowFirstRun(false)} />}
        <div className="app-shell">
          <main className="app-main">
            <LibraryPage
              page={page}
              onNavigate={setPage}
              onSelect={setSelectedAppid}
              onGoToSettings={() => setPage('settings')}
              onGoToHelp={() => setPage('help')}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onDisplayedGamesChange={setLibraryGames}
            />
          </main>
        </div>
      </>
    )
  }

  if (page === 'settings') {
    return (
      <>
        {recapOverlay}
        <div className="app-shell">
          <main className="app-main">
            <SettingsPage page={page} onNavigate={setPage} />
          </main>
        </div>
      </>
    )
  }

  if (page === 'dashboard') {
    return (
      <>
        {recapOverlay}
        {showFirstRun && <FirstRunWelcome onDismiss={() => setShowFirstRun(false)} />}
        <div className="app-shell">
          <main className="app-main">
            <DashboardPage
              page={page}
              onNavigate={setPage}
              onSelectGame={setSelectedAppid}
            />
          </main>
        </div>
      </>
    )
  }

  if (page === 'help') {
    return (
      <>
        {recapOverlay}
        <div className="app-shell">
          <main className="app-main">
            <HelpPage page={page} onNavigate={setPage} />
          </main>
        </div>
      </>
    )
  }

  return <>{recapOverlay}</>
}
