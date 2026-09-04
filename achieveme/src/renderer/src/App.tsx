import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActiveDepotSession,
  ActiveUpdateSession,
  DepotProgressEvent,
  GameSummary,
  NewsPayload,
  SessionRecapPayload
} from '../../shared/types'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import NewsPage, { NEWS_LOAD_ERROR, type NewsLoadState } from './pages/NewsPage'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import ToolsPage from './pages/ToolsPage'
import HelpPage from './pages/HelpPage'
import FirstRunWelcome from './components/FirstRunWelcome'
import SessionRecapModal from './components/SessionRecapModal'
import DepotWizard from './components/DepotWizard'
import TransfersDock from './components/TransfersDock'
import AddGameModal from './components/AddGameModal'
import { shouldShowFirstRun } from './lib/helpStorage'
import type { AppPage } from './lib/appNavigation'
import { pruneNewsPayloadForLibrary } from '../../shared/newsUtils'
import {
  buildTransferDockRows,
  type TransferDockRow
} from '../../shared/transfersDockUtils'

type TransitionDir = 'next' | 'prev' | null

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
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [transfersExpanded, setTransfersExpanded] = useState(false)
  const [addGamePrefill, setAddGamePrefill] = useState<{
    appid: string
    name: string
    installPath?: string
  } | null>(null)
  const [newsPayload, setNewsPayload] = useState<NewsPayload | null>(null)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsLoadState, setNewsLoadState] = useState<NewsLoadState>('loading')
  const depotSessionRef = useRef<ActiveDepotSession | null>(null)

  useEffect(() => {
    depotSessionRef.current = activeDepotSession
  }, [activeDepotSession])

  const handleNewsResult = useCallback(
    (result: {
      payload: NewsPayload | null
      errorMessage: string | null
      loadState: NewsLoadState
    }): void => {
      setNewsPayload(result.payload)
      setNewsError(result.errorMessage)
      setNewsLoadState(result.loadState)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    void window.api
      .getNews({ forceRefresh: false })
      .then((data) => {
        if (cancelled) return
        setNewsPayload(data)
        setNewsError(null)
        setNewsLoadState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setNewsError(NEWS_LOAD_ERROR)
        setNewsLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      void window.api.getAllGames().then((games) => {
        setLibraryGames(games)
        const libraryIds = new Set(games.map((g) => g.appid))
        setNewsPayload((prev) =>
          prev ? pruneNewsPayloadForLibrary(prev, libraryIds) : prev
        )
      })
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

  const transferRows = buildTransferDockRows({
    depot: activeDepotSession,
    update: activeUpdateSession
  })

  function handleOpenTransferRow(row: TransferDockRow): void {
    setTransfersExpanded(false)
    if (row.openTarget === 'depot') {
      setDepotWizardOpen(true)
      return
    }
    setUpdateModalOpen(true)
  }

  const depotOverlay = (
    <>
      <TransfersDock
        rows={transferRows}
        expanded={transfersExpanded}
        onToggle={() => setTransfersExpanded((open) => !open)}
        onOpenRow={handleOpenTransferRow}
      />
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

  if (page === 'news') {
    return (
      <>
        {recapOverlay}
        {depotOverlay}
        <div className="app-shell">
          <main className="app-main">
            <NewsPage
              page={page}
              onNavigate={setPage}
              onSelectGame={setSelectedAppid}
              payload={newsPayload}
              errorMessage={newsError}
              loadState={newsLoadState}
              onNewsResult={handleNewsResult}
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
              onOpenImportWizard={() => {
                handleDepotSessionChange({
                  channelId: `download:${crypto.randomUUID()}`,
                  appId: '',
                  gameName: '',
                  phase: 'search',
                  importMode: true,
                  gameData: null,
                  selectedDepots: [],
                  outputPath: '',
                  logs: [],
                  pct: 0,
                  speedBps: null,
                  etaSec: null,
                  status: ''
                })
                setDepotWizardOpen(true)
              }}
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
