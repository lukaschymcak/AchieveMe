import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActiveDepotSession,
  ActiveUpdateSession,
  DepotProgressEvent,
  GameSummary,
  SessionRecapPayload
} from '../../shared/types'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import ToolsPage from './pages/ToolsPage'
import HelpPage from './pages/HelpPage'
import FirstRunWelcome from './components/FirstRunWelcome'
import SessionRecapModal from './components/SessionRecapModal'
import DepotWizard from './components/DepotWizard'
import AddGameModal from './components/AddGameModal'
import { shouldShowFirstRun } from './lib/helpStorage'
import type { AppPage } from './lib/appNavigation'

type TransitionDir = 'next' | 'prev' | null

function isDownloadInProgress(session: ActiveDepotSession | null): boolean {
  if (!session) return false
  return (
    session.phase === 'fetching' ||
    session.phase === 'downloading' ||
    session.phase === 'depots'
  )
}

export default function App(): React.ReactElement {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [selectedAppid, setSelectedAppid] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [libraryGames, setLibraryGames] = useState<GameSummary[]>([])
  const [transitionDir, setTransitionDir] = useState<TransitionDir>(null)
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun())
  const [sessionRecap, setSessionRecap] = useState<SessionRecapPayload | null>(null)
  const [activeDepotSession, setActiveDepotSession] = useState<ActiveDepotSession | null>(null)
  const [activeUpdateSession, setActiveUpdateSession] = useState<ActiveUpdateSession | null>(null)
  const [depotWizardOpen, setDepotWizardOpen] = useState(false)
  const [addGamePrefill, setAddGamePrefill] = useState<{
    appid: string
    name: string
    installPath?: string
  } | null>(null)
  const depotSessionRef = useRef<ActiveDepotSession | null>(null)

  useEffect(() => {
    depotSessionRef.current = activeDepotSession
  }, [activeDepotSession])

  const handleDepotSessionChange = useCallback((session: ActiveDepotSession | null): void => {
    depotSessionRef.current = session
    setActiveDepotSession(session)
  }, [])

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

  useEffect(() => {
    function handleDepotProgress(ev: DepotProgressEvent): void {
      const prev = depotSessionRef.current
      if (!prev) return
      if (ev.channelId && ev.channelId !== prev.channelId) return

      const nextLogs = ev.log
        ? [...prev.logs, ...ev.log.split('\n').filter(Boolean)].slice(-400)
        : prev.logs

      let phase = prev.phase
      if (ev.done && ev.canceled) phase = 'canceled'
      else if (ev.done && ev.error) phase = 'failed'
      else if (ev.done && ev.terminalReason === 'completed') phase = 'prompt'
      else if (prev.phase === 'downloading' || prev.phase === 'fetching') {
        // stay on downloading while progress ticks
        if (prev.phase === 'downloading') phase = 'downloading'
      }

      const next: ActiveDepotSession = {
        ...prev,
        phase,
        logs: nextLogs,
        pct: typeof ev.pct === 'number' ? ev.pct : prev.pct,
        speedBps: ev.speedBps !== undefined ? ev.speedBps : prev.speedBps,
        etaSec: ev.etaSec !== undefined ? ev.etaSec : prev.etaSec,
        status: ev.status ?? prev.status,
        error: ev.error ?? prev.error,
        gameName: ev.gameName ?? prev.gameName,
        headerImageUrl: ev.headerImageUrl ?? prev.headerImageUrl,
        appId: ev.appId ?? prev.appId
      }
      depotSessionRef.current = next
      setActiveDepotSession(next)
    }

    window.api.onDepotProgress(handleDepotProgress)
    return () => {
      window.api.offDepotProgress(handleDepotProgress)
    }
  }, [])

  function handleSetupAchievements(appid: string, name: string, installPath?: string): void {
    setAddGamePrefill({ appid, name, installPath })
  }

  const addGameOverlay = addGamePrefill ? (
    <AddGameModal
      prefill={addGamePrefill}
      onClose={() => setAddGamePrefill(null)}
      onGameAdded={() => {
        void window.api.getAllGames().then(setLibraryGames)
        void window.api.refresh()
        setAddGamePrefill(null)
      }}
    />
  ) : null

  const recapOverlay = sessionRecap ? (
    <SessionRecapModal payload={sessionRecap} onDismiss={dismissSessionRecap} />
  ) : null

  const depotOverlay = (
    <>
      {isDownloadInProgress(activeDepotSession) && (
        <button
          type="button"
          className="depot-download-badge"
          onClick={() => setDepotWizardOpen(true)}
          aria-label={`Download in progress: ${activeDepotSession?.gameName ?? 'game'}`}
        >
          {activeDepotSession?.headerImageUrl ? (
            <img
              src={activeDepotSession.headerImageUrl}
              alt=""
              className="depot-download-badge__thumb"
            />
          ) : (
            <span className="depot-download-badge__thumb depot-download-badge__thumb--empty" />
          )}
          <span className="depot-download-badge__meta">
            <span className="depot-download-badge__name">
              {activeDepotSession?.gameName || 'Download'}
            </span>
            <span className="depot-download-badge__bar" aria-hidden="true">
              <span
                className="depot-download-badge__fill"
                style={{
                  width: `${Math.max(0, Math.min(100, activeDepotSession?.pct ?? 0))}%`
                }}
              />
            </span>
            <span className="depot-download-badge__pct">
              {Math.round(activeDepotSession?.pct ?? 0)}%
            </span>
          </span>
        </button>
      )}
      {depotWizardOpen && (
        <DepotWizard
          session={activeDepotSession}
          onSessionChange={handleDepotSessionChange}
          onClose={() => setDepotWizardOpen(false)}
          onGameAdded={() => {
            void window.api.getAllGames().then(setLibraryGames)
            void window.api.refresh()
          }}
        />
      )}
    </>
  )

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
        {depotOverlay}
        {addGameOverlay}
        <div className="app-shell app-shell--game-detail">
          <main className="app-main">
            <GameDetailPage
              appid={selectedAppid}
              transitionDir={transitionDir}
              activeUpdateSession={activeUpdateSession}
              onUpdateSessionChange={setActiveUpdateSession}
              onSetupAchievements={(name, installPath) =>
                handleSetupAchievements(selectedAppid, name, installPath)
              }
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
        {depotOverlay}
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

  if (page === 'tools') {
    return (
      <>
        {recapOverlay}
        {depotOverlay}
        <div className="app-shell">
          <main className="app-main">
            <ToolsPage
              page={page}
              onNavigate={setPage}
              onOpenDepotWizard={() => setDepotWizardOpen(true)}
              depotSession={activeDepotSession}
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
        {depotOverlay}
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
        {depotOverlay}
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
        {depotOverlay}
        <div className="app-shell">
          <main className="app-main">
            <HelpPage page={page} onNavigate={setPage} />
          </main>
        </div>
      </>
    )
  }

  return (
    <>
      {recapOverlay}
      {depotOverlay}
    </>
  )
}
