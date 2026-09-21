import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActiveDepotSession,
  ActiveUpdateSession,
  BootWarmProgress,
  DepotProgressEvent,
  GameSummary,
  NewsPayload,
  SessionRecapPayload,
  AppUpdateState,
  PendingChangelog
} from '../../shared/types'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import NewsPage, { NEWS_LOAD_ERROR, type NewsLoadState } from './pages/NewsPage'
import GameDetailPage, { type OpenUpdateTransferInput } from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'
import ToolsPage from './pages/ToolsPage'
import HelpPage from './pages/HelpPage'
import FirstRunWelcome from './components/FirstRunWelcome'
import BootSplash from './components/BootSplash'
import SessionRecapModal from './components/SessionRecapModal'
import ChangelogModal from './components/ChangelogModal'
import DepotWizard from './components/DepotWizard'
import TransfersDock from './components/TransfersDock'
import UpdateTransferModal from './components/UpdateTransferModal'
import AddGameModal from './components/AddGameModal'
import InstalledGamesScanModal from './components/InstalledGamesScanModal'
import UpdateBanner from './components/UpdateBanner'
import { shouldShowFirstRun } from './lib/helpStorage'
import type { AppPage } from './lib/appNavigation'
import { pruneNewsPayloadForLibrary } from '../../shared/newsUtils'
import {
  buildTransferDockRows,
  type TransferDockRow
} from '../../shared/transfersDockUtils'
import { nextUpdatePhaseAfterSuccess } from '../../shared/updateTransferUtils'

type TransitionDir = 'next' | 'prev' | null

export default function App(): React.ReactElement {
  const [bootReady, setBootReady] = useState(false)
  const [bootExiting, setBootExiting] = useState(false)
  const [bootSplashPreview, setBootSplashPreview] = useState(false)
  const [bootProgress, setBootProgress] = useState<BootWarmProgress | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [page, setPage] = useState<AppPage>('dashboard')
  const [selectedAppid, setSelectedAppid] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [libraryGames, setLibraryGames] = useState<GameSummary[]>([])
  const [transitionDir, setTransitionDir] = useState<TransitionDir>(null)
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun())
  const [sessionRecap, setSessionRecap] = useState<SessionRecapPayload | null>(null)
  const [activeDepotSession, setActiveDepotSession] = useState<ActiveDepotSession | null>(null)
  const [activeUpdateSession, setActiveUpdateSession] = useState<ActiveUpdateSession | null>(null)
  const [updateManifestGidsJson, setUpdateManifestGidsJson] = useState('')
  const [depotWizardOpen, setDepotWizardOpen] = useState(false)
  const [scanInstalledOpen, setScanInstalledOpen] = useState(false)
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
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null)
  const [changelogPayload, setChangelogPayload] = useState<PendingChangelog | null>(null)
  const depotSessionRef = useRef<ActiveDepotSession | null>(null)
  const updateSessionRef = useRef<ActiveUpdateSession | null>(null)
  const updateJobRunningRef = useRef(false)

  const finishBoot = useCallback(() => {
    setBootExiting(true)
    window.setTimeout(() => {
      setBootReady(true)
    }, 280)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!window.api) {
      setBootProgress({
        phase: 'games',
        current: 7,
        total: 12,
        label: 'Warming games (7/12)…'
      })
      return
    }

    window.api.onBootWarmProgress((progress) => {
      if (!cancelled) setBootProgress(progress)
    })
    void window.api
      .runBootWarm()
      .then((result) => {
        if (cancelled) return
        if (!result.ok && result.errorMessage) {
          setBootError(result.errorMessage)
        }
        finishBoot()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setBootError(err instanceof Error ? err.message : String(err))
        finishBoot()
      })
      .finally(() => {
        window.api?.offBootWarmProgress()
      })
    return () => {
      cancelled = true
      window.api?.offBootWarmProgress()
    }
  }, [finishBoot])

  // Dev shortcut: Ctrl+Shift+B toggles simulated boot splash preview
  useEffect(() => {
    const handleDevShortcuts = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setBootSplashPreview((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleDevShortcuts)
    return () => window.removeEventListener('keydown', handleDevShortcuts)
  }, [])

  useEffect(() => {
    depotSessionRef.current = activeDepotSession
  }, [activeDepotSession])

  useEffect(() => {
    updateSessionRef.current = activeUpdateSession
  }, [activeUpdateSession])

  useEffect(() => {
    if (!window.api?.getUpdateState) return
    void window.api.getUpdateState().then(setUpdateState)
    const handleUpdateChange = (state: AppUpdateState) => {
      setUpdateState(state)
    }
    window.api.onUpdateStateChanged(handleUpdateChange)
    return () => {
      window.api?.offUpdateStateChanged?.(handleUpdateChange)
    }
  }, [])

  const handleInstallUpdate = useCallback(() => {
    void window.api?.installUpdate()
  }, [])

  const handleUpdateSessionChange = useCallback((session: ActiveUpdateSession | null): void => {
    updateSessionRef.current = session
    setActiveUpdateSession(session)
  }, [])

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
    if (!bootReady) return
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
  }, [bootReady])

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
    if (!window.api?.onShowChangelog) return
    const handleShowChangelog = (payload: PendingChangelog) => {
      setChangelogPayload(payload)
    }
    window.api.onShowChangelog(handleShowChangelog)
    return () => {
      window.api?.offShowChangelog?.(handleShowChangelog)
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

  const handleOpenUpdateTransfer = useCallback(
    (input: OpenUpdateTransferInput): void => {
      const prev = updateSessionRef.current
      if (prev?.busy) {
        if (prev.appid === input.appid) setUpdateModalOpen(true)
        return
      }
      if (
        prev &&
        prev.appid === input.appid &&
        prev.phase !== 'pick_depots' &&
        prev.phase !== 'done'
      ) {
        setUpdateModalOpen(true)
        return
      }
      if (updateJobRunningRef.current) return

      const session: ActiveUpdateSession = {
        appid: input.appid,
        mode: input.mode,
        busy: false,
        pct: 0,
        label: '',
        error: '',
        gameName: input.gameName,
        phase: 'pick_depots',
        installPath: input.installPath,
        steamlessApplied: input.steamlessApplied,
        goldbergApplied: input.goldbergApplied,
        steamlessExe: input.steamlessExe,
        goldbergDllPath: input.goldbergDllPath,
        headerImageUrl: input.headerImageUrl
      }
      setUpdateManifestGidsJson(input.manifestGidsJson)
      handleUpdateSessionChange(session)
      setUpdateModalOpen(true)
    },
    [handleUpdateSessionChange]
  )

  const runUpdateJob = useCallback(
    async (selectedDepots: string[]): Promise<void> => {
      const session = updateSessionRef.current
      if (!session || updateJobRunningRef.current) return
      if (!selectedDepots.length) return

      const { appid, mode, installPath } = session
      if (!installPath.trim()) {
        handleUpdateSessionChange({
          ...session,
          phase: 'error',
          busy: false,
          error:
            mode === 'validate'
              ? 'Set an install folder before validating.'
              : 'Set an install folder before updating.'
        })
        return
      }

      const channelId = `depot:${appid}:${mode}`
      const manifestChannelId = `manifest:${mode}-game:progress:${appid}`
      let finished = false
      updateJobRunningRef.current = true

      const patch = (partial: Partial<ActiveUpdateSession>): void => {
        const prev = updateSessionRef.current
        if (!prev || prev.appid !== appid) return
        const next = { ...prev, ...partial }
        updateSessionRef.current = next
        setActiveUpdateSession(next)
      }

      patch({
        busy: true,
        pct: 0,
        label: mode === 'validate' ? 'Preparing validate…' : 'Fetching manifest…',
        error: '',
        phase: 'running',
        selectedDepots
      })

      const handleManifestProgress = (payload: {
        pct?: number
        received?: number
        total?: number
        status?: string
        error?: string
      }): void => {
        if (finished) return
        let pct = 0
        if (typeof payload.pct === 'number') pct = payload.pct
        else if (
          typeof payload.received === 'number' &&
          typeof payload.total === 'number' &&
          payload.total > 0
        ) {
          pct = Math.round((payload.received * 100) / payload.total)
        }
        patch({
          pct,
          label: payload.status || 'Fetching manifest…',
          error: payload.error || ''
        })
      }

      const handleDepotProgress = (payload: {
        channelId?: string
        pct?: number
        status?: string
        error?: string
        done?: boolean
      }): void => {
        if (finished) return
        if (payload.channelId && payload.channelId !== channelId) return
        if (payload.done) return
        patch({
          ...(typeof payload.pct === 'number' ? { pct: payload.pct } : {}),
          ...(payload.status ? { label: payload.status } : {}),
          error: payload.error || ''
        })
      }

      window.api.onDepotLog(manifestChannelId, handleManifestProgress)
      window.api.onDepotProgress(handleDepotProgress)

      try {
        if (mode === 'validate') {
          await window.api.manifestValidateGame(appid, installPath, selectedDepots)
        } else {
          await window.api.manifestUpdateGame(appid, installPath, selectedDepots)
        }
        finished = true
        const snap = updateSessionRef.current
        if (!snap) return

        if (mode === 'validate') {
          handleUpdateSessionChange(null)
          setUpdateModalOpen(false)
          setUpdateManifestGidsJson('')
          void window.api.getAllGames().then(setLibraryGames)
          return
        }

        const nextPhase = nextUpdatePhaseAfterSuccess({
          steamlessApplied: snap.steamlessApplied,
          goldbergApplied: snap.goldbergApplied
        })
        if (nextPhase === 'done') {
          handleUpdateSessionChange(null)
          setUpdateModalOpen(false)
          setUpdateManifestGidsJson('')
        } else {
          patch({
            busy: false,
            pct: 100,
            label: 'Update finished',
            error: '',
            phase: nextPhase
          })
          setUpdateModalOpen(true)
        }
        void window.api.getAllGames().then(setLibraryGames)
      } catch (err) {
        finished = true
        const message = err instanceof Error ? err.message : String(err)
        const prev = updateSessionRef.current
        if (prev) {
          handleUpdateSessionChange({
            ...prev,
            busy: false,
            pct: 0,
            label: '',
            error: message,
            phase: 'error'
          })
          setUpdateModalOpen(true)
        }
      } finally {
        finished = true
        updateJobRunningRef.current = false
        window.api.offDepotLog(manifestChannelId)
        window.api.offDepotProgress(handleDepotProgress)
      }
    },
    [handleUpdateSessionChange]
  )

  const handleCloseUpdateModal = useCallback((): void => {
    const session = updateSessionRef.current
    if (session?.phase === 'pick_depots' && !session.busy) {
      handleUpdateSessionChange(null)
      setUpdateManifestGidsJson('')
    }
    setUpdateModalOpen(false)
  }, [handleUpdateSessionChange])

  const handleDismissUpdateComplete = useCallback((): void => {
    handleUpdateSessionChange(null)
    setUpdateManifestGidsJson('')
    setUpdateModalOpen(false)
  }, [handleUpdateSessionChange])

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

  const changelogOverlay = changelogPayload ? (
    <ChangelogModal
      payload={changelogPayload}
      onDismiss={() => setChangelogPayload(null)}
    />
  ) : null

  const transferRows = buildTransferDockRows({
    depot: activeDepotSession,
    update: activeUpdateSession,
    depotModalOpen: depotWizardOpen,
    updateModalOpen: updateModalOpen
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
      {updateModalOpen && activeUpdateSession && (
        <UpdateTransferModal
          session={activeUpdateSession}
          manifestGidsJson={updateManifestGidsJson}
          onSessionChange={handleUpdateSessionChange}
          onConfirmDepots={(selected) => {
            void runUpdateJob(selected)
          }}
          onClose={handleCloseUpdateModal}
          onDismissComplete={handleDismissUpdateComplete}
        />
      )}
    </>
  )

  const updateOverlay = (
    <UpdateBanner updateState={updateState} onInstall={handleInstallUpdate} />
  )

  if (!bootReady || bootSplashPreview) {
    const previewSample: BootWarmProgress = {
      phase: 'games',
      current: 7,
      total: 12,
      label: 'Warming games (7/12)…'
    }

    return (
      <BootSplash
        progress={bootSplashPreview ? previewSample : bootProgress}
        isExiting={bootExiting && !bootSplashPreview}
        onSkip={() => {
          if (bootSplashPreview) {
            setBootSplashPreview(false)
          } else {
            finishBoot()
          }
        }}
      />
    )
  }

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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
        {addGameOverlay}
        <div className="app-shell app-shell--game-detail">
          <main className="app-main">
            <GameDetailPage
              appid={selectedAppid}
              transitionDir={transitionDir}
              activeUpdateSession={activeUpdateSession}
              onOpenUpdateTransfer={handleOpenUpdateTransfer}
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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
        <div className="app-shell">
          <main className="app-main">
            <ToolsPage
              page={page}
              onNavigate={setPage}
              onOpenDepotWizard={() => setDepotWizardOpen(true)}
              onOpenScanInstalled={() => setScanInstalledOpen(true)}
              depotSession={activeDepotSession}
            />
          </main>
        </div>
        {scanInstalledOpen && (
          <InstalledGamesScanModal
            onClose={() => setScanInstalledOpen(false)}
            onImported={() => {
              void window.api.getAllGames().then(setLibraryGames)
            }}
          />
        )}
      </>
    )
  }

  if (page === 'settings') {
    return (
      <>
        {recapOverlay}
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
        {bootError ? (
          <div className="boot-warm-banner" role="status">
            <span>
              Startup warm had issues — library may show incomplete network data until you
              Refresh. ({bootError})
            </span>
            <button
              type="button"
              className="boot-warm-banner__dismiss"
              aria-label="Dismiss startup warning"
              onClick={() => setBootError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}
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
        {changelogOverlay}
        {depotOverlay}
        {updateOverlay}
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
      {changelogOverlay}
      {depotOverlay}
      {updateOverlay}
    </>
  )
}
