import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ActiveDepotSession,
  DepotPhase,
  DepotProgressEvent,
  DepotSearchResult,
  GameData,
  SteamApiDllInfo
} from '../../../shared/types'
import { AppSearchInput, Chip } from './app'
import { ADD_GAME } from '../lib/helpContent'

interface Props {
  session: ActiveDepotSession | null
  onSessionChange: (session: ActiveDepotSession | null) => void
  onClose: () => void
  onGameAdded?: () => void
}

type ApplyState = 'idle' | 'running' | 'done' | 'error'

const STEP_TITLES: Partial<Record<DepotPhase, string>> = {
  search: 'Depot Downloader — Search',
  fetching: 'Depot Downloader — Manifest',
  depots: 'Depot Downloader — Depots',
  downloading: 'Depot Downloader — Downloading',
  prompt: 'Depot Downloader — Complete',
  dll: 'Depot Downloader — Steam API DLL',
  emu: 'Depot Downloader — Emulator',
  apply: 'Depot Downloader — Apply Goldberg',
  complete: 'Depot Downloader — Done',
  canceled: 'Depot Downloader — Canceled',
  failed: 'Depot Downloader — Failed'
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function formatSpeed(bps: number | null): string {
  if (bps == null || bps <= 0) return '—'
  const mbps = bps / (1024 * 1024)
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
  return `${(bps / 1024).toFixed(0)} KB/s`
}

function formatEta(sec: number | null): string {
  if (sec == null || sec < 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function createEmptySession(overrides: Partial<ActiveDepotSession> = {}): ActiveDepotSession {
  return {
    channelId: `download:${crypto.randomUUID()}`,
    appId: '',
    gameName: '',
    phase: 'search',
    gameData: null,
    selectedDepots: [],
    outputPath: '',
    logs: [],
    pct: 0,
    speedBps: null,
    etaSec: null,
    status: '',
    ...overrides
  }
}

/**
 * Multi-step Hubcap + DepotDownloader wizard.
 * Backdrop clicks do not close — only the X button does.
 */
export default function DepotWizard({
  session,
  onSessionChange,
  onClose,
  onGameAdded
}: Props): React.ReactElement {
  const local = session ?? createEmptySession()
  const phase = local.phase

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<DepotSearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<DepotSearchResult | null>(null)
  const [fetchPct, setFetchPct] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [outputPath, setOutputPath] = useState(local.outputPath)
  const [errorMsg, setErrorMsg] = useState(local.error ?? '')
  const [dllInfo, setDllInfo] = useState<SteamApiDllInfo | null>(local.dllInfo ?? null)
  const [installEmuDll, setInstallEmuDll] = useState(local.installEmuDll ?? false)
  const [denuvoOfflineActivated, setDenuvoOfflineActivated] = useState(
    local.denuvoOfflineActivated ?? false
  )
  const [applyState, setApplyState] = useState<ApplyState>('idle')
  const [goldbergLogs, setGoldbergLogs] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [local.logs, goldbergLogs])

  useEffect(() => {
    if (local.gameData && Object.keys(selected).length === 0) {
      const next: Record<string, boolean> = {}
      for (const id of Object.keys(local.gameData.depots)) next[id] = true
      setSelected(next)
    }
  }, [local.gameData, selected])

  useEffect(() => {
    if (local.outputPath && !outputPath) setOutputPath(local.outputPath)
  }, [local.outputPath, outputPath])

  useEffect(() => {
    return () => {
      window.api.offGoldbergLog()
      if (searchRef.current) clearTimeout(searchRef.current)
    }
  }, [])

  function patchSession(patch: Partial<ActiveDepotSession>): void {
    onSessionChange({ ...local, ...patch })
  }

  function handleQueryChange(value: string): void {
    setQuery(value)
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    searchRef.current = setTimeout(() => {
      void runSearch(value)
    }, 400)
  }

  async function runSearch(q: string): Promise<void> {
    setSearching(true)
    setErrorMsg('')
    try {
      const res = await window.api.depotSearch(q, 'games')
      setResults(res.results)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectGame(result: DepotSearchResult): Promise<void> {
    setSelectedResult(result)
    setErrorMsg('')
    setFetchPct(0)
    const manifestChannel = `manifest:${crypto.randomUUID()}`
    const nextSession = createEmptySession({
      channelId: `download:${crypto.randomUUID()}`,
      appId: result.gameId,
      gameName: result.gameName,
      headerImageUrl: result.headerImageUrl,
      phase: 'fetching',
      status: 'Fetching manifest…'
    })
    onSessionChange(nextSession)

    window.api.onDepotLog(manifestChannel, (payload: DepotProgressEvent) => {
      if (typeof payload.pct === 'number') setFetchPct(payload.pct)
    })

    try {
      const zipPath = await window.api.depotDownloadManifest(result.gameId, manifestChannel)
      const gameData = await window.api.depotProcessZip(zipPath)
      gameData.headerImageUrl = result.headerImageUrl
      const settings = await window.api.getSettings()
      const defaultOut = settings.depotDownloadPath.trim()
      const nextSelected: Record<string, boolean> = {}
      for (const id of Object.keys(gameData.depots)) nextSelected[id] = true
      setSelected(nextSelected)
      setOutputPath(defaultOut)
      onSessionChange({
        ...nextSession,
        phase: 'depots',
        gameData,
        zipPath,
        selectedDepots: Object.keys(gameData.depots),
        outputPath: defaultOut,
        status: 'Select depots'
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorMsg(message)
      onSessionChange({
        ...nextSession,
        phase: 'failed',
        error: message,
        status: 'Failed'
      })
    } finally {
      window.api.offDepotLog(manifestChannel)
    }
  }

  async function handleBrowseOutput(): Promise<void> {
    const picked = await window.api.depotBrowseOutputFolder()
    if (picked) {
      setOutputPath(picked)
      patchSession({ outputPath: picked })
    }
  }

  async function handleStartDownload(): Promise<void> {
    if (!local.gameData) return
    const depotIds = Object.keys(selected).filter((id) => selected[id])
    if (depotIds.length === 0) {
      setErrorMsg('Select at least one depot.')
      return
    }
    let out = outputPath.trim()
    if (!out) {
      const picked = await window.api.depotBrowseOutputFolder()
      if (!picked) return
      out = picked
      setOutputPath(picked)
    }

    const channelId = local.channelId || `download:${crypto.randomUUID()}`
    setErrorMsg('')
    onSessionChange({
      ...local,
      channelId,
      phase: 'downloading',
      selectedDepots: depotIds,
      outputPath: out,
      logs: [],
      pct: 0,
      speedBps: null,
      etaSec: null,
      status: 'Starting…',
      error: undefined
    })

    try {
      await window.api.depotStartDownload({
        gameData: local.gameData,
        selectedDepots: depotIds,
        libraryPath: out,
        outputPath: out,
        maxDownloads: 20,
        channelId
      })
      // App progress listener may already have set phase to prompt; reinforce on resolve.
      onSessionChange({
        ...local,
        channelId,
        phase: 'prompt',
        selectedDepots: depotIds,
        outputPath: out,
        pct: 100,
        status: 'Complete',
        speedBps: null,
        etaSec: null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/canceled/i.test(message)) {
        onSessionChange({
          ...local,
          channelId,
          phase: 'canceled',
          status: 'Canceled',
          error: message
        })
      } else {
        setErrorMsg(message)
        onSessionChange({
          ...local,
          channelId,
          phase: 'failed',
          status: 'Failed',
          error: message
        })
      }
    }
  }

  async function handleCancel(): Promise<void> {
    await window.api.depotCancelDownload(local.channelId, 'keep')
    patchSession({ phase: 'canceled', status: 'Canceled' })
  }

  async function handleSetupAchievements(): Promise<void> {
    setErrorMsg('')
    setDllInfo(null)
    patchSession({ phase: 'dll' })
    const root = local.outputPath
    if (!root) {
      setErrorMsg('No download folder recorded.')
      return
    }
    try {
      const found = await window.api.depotScanDll(root)
      if (found) setDllInfo(found)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleBrowseDll(): Promise<void> {
    try {
      const info = await window.api.browseDllPath()
      if (info) setDllInfo(info)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleApplyGoldberg(): Promise<void> {
    if (!dllInfo || !local.appId) return
    setApplyState('running')
    setGoldbergLogs([])
    setErrorMsg('')
    patchSession({
      phase: 'apply',
      dllInfo,
      installEmuDll,
      denuvoOfflineActivated
    })
    window.api.onGoldbergLog((line) => {
      setGoldbergLogs((prev) => [...prev, line])
    })
    try {
      await window.api.applyGoldberg({
        appid: local.appId,
        dllPath: dllInfo.path,
        installEmuDll,
        denuvoOfflineActivated
      })
      setApplyState('done')
      patchSession({ phase: 'complete', status: 'Game added' })
    } catch (err) {
      setApplyState('error')
      const message = err instanceof Error ? err.message : String(err)
      setErrorMsg(message)
      patchSession({ error: message })
    } finally {
      window.api.offGoldbergLog()
    }
  }

  function handleDone(): void {
    onGameAdded?.()
    onSessionChange(null)
    onClose()
  }

  function handleSkipSetup(): void {
    onSessionChange(null)
    onClose()
  }

  const selectedDepotIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  )
  const selectedSize = useMemo(() => {
    if (!local.gameData) return 0
    return selectedDepotIds.reduce(
      (sum, id) => sum + Number(local.gameData!.depots[id]?.size || 0),
      0
    )
  }, [local.gameData, selectedDepotIds])

  const title = STEP_TITLES[phase] ?? 'Depot Downloader'

  return (
    <div className="depot-wizard-backdrop" role="presentation">
      <div
        className="depot-wizard"
        role="dialog"
        aria-modal="true"
        aria-label="Depot Downloader wizard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="depot-wizard__header">
          <h2 className="depot-wizard__title">{title}</h2>
          <button
            type="button"
            className="depot-wizard__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {errorMsg && phase !== 'apply' && (
          <p className="depot-wizard__error" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="depot-wizard__body">
          {phase === 'search' && (
            <SearchStep
              query={query}
              onQueryChange={handleQueryChange}
              searching={searching}
              results={results}
              selected={selectedResult}
              onSelect={(r) => void handleSelectGame(r)}
            />
          )}

          {phase === 'fetching' && (
            <div className="depot-wizard__panel">
              <p className="depot-wizard__help">
                Downloading Hubcap manifest for {local.gameName || selectedResult?.gameName}…
              </p>
              <div className="depot-wizard__progress-track" aria-valuenow={fetchPct}>
                <div
                  className="depot-wizard__progress-fill"
                  style={{ width: `${Math.max(0, Math.min(100, fetchPct))}%` }}
                />
              </div>
              <p className="depot-wizard__muted">{fetchPct}%</p>
            </div>
          )}

          {phase === 'depots' && local.gameData && (
            <DepotsStep
              gameData={local.gameData}
              headerImageUrl={local.headerImageUrl}
              selected={selected}
              onToggle={(id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }))}
              outputPath={outputPath}
              onBrowseOutput={() => void handleBrowseOutput()}
              selectedSize={selectedSize}
            />
          )}

          {(phase === 'downloading' || phase === 'canceled' || phase === 'failed') && (
            <DownloadStep
              session={local}
              logRef={logRef}
              onCancel={() => void handleCancel()}
              canCancel={phase === 'downloading'}
            />
          )}

          {phase === 'prompt' && (
            <div className="depot-wizard__panel">
              <p className="depot-wizard__ok">Download complete!</p>
              <p className="depot-wizard__help">
                Would you like to set up achievements for {local.gameName}?
              </p>
              {local.outputPath && (
                <p className="depot-wizard__path" title={local.outputPath}>
                  {local.outputPath}
                </p>
              )}
            </div>
          )}

          {phase === 'dll' && (
            <DllStep
              gameName={local.gameName}
              appId={local.appId}
              headerImageUrl={local.headerImageUrl}
              dllInfo={dllInfo}
              onBrowse={() => void handleBrowseDll()}
              errorMsg={errorMsg}
            />
          )}

          {phase === 'emu' && dllInfo && (
            <EmuStep
              gameName={local.gameName}
              appId={local.appId}
              headerImageUrl={local.headerImageUrl}
              dllInfo={dllInfo}
              installEmuDll={installEmuDll}
              onInstallEmuDllChange={setInstallEmuDll}
              denuvoOfflineActivated={denuvoOfflineActivated}
              onDenuvoOfflineActivatedChange={setDenuvoOfflineActivated}
            />
          )}

          {(phase === 'apply' || phase === 'complete') && dllInfo && (
            <ApplyStep
              gameName={local.gameName}
              appId={local.appId}
              headerImageUrl={local.headerImageUrl}
              dllInfo={dllInfo}
              applyState={phase === 'complete' ? 'done' : applyState}
              logLines={goldbergLogs}
              logRef={logRef}
              errorMsg={errorMsg}
            />
          )}
        </div>

        <div className="depot-wizard__footer">
          {phase === 'search' && <Chip onClick={onClose}>Close</Chip>}

          {phase === 'depots' && (
            <>
              <Chip
                onClick={() => {
                  onSessionChange(createEmptySession())
                  setResults([])
                  setSelectedResult(null)
                  setQuery('')
                }}
              >
                Back
              </Chip>
              <Chip
                variant="action"
                disabled={selectedDepotIds.length === 0}
                onClick={() => void handleStartDownload()}
              >
                Start download
              </Chip>
            </>
          )}

          {phase === 'prompt' && (
            <>
              <Chip onClick={handleSkipSetup}>Skip</Chip>
              <Chip variant="action" onClick={() => void handleSetupAchievements()}>
                Set up achievements
              </Chip>
            </>
          )}

          {phase === 'dll' && (
            <>
              <Chip onClick={() => patchSession({ phase: 'prompt' })}>Back</Chip>
              <Chip
                variant="action"
                disabled={!dllInfo}
                onClick={() => {
                  if (!dllInfo) return
                  patchSession({ phase: 'emu', dllInfo })
                }}
              >
                Next
              </Chip>
            </>
          )}

          {phase === 'emu' && (
            <>
              <Chip onClick={() => patchSession({ phase: 'dll' })}>Back</Chip>
              <Chip
                variant="action"
                onClick={() => {
                  setApplyState('idle')
                  setGoldbergLogs([])
                  void handleApplyGoldberg()
                }}
              >
                Next
              </Chip>
            </>
          )}

          {phase === 'apply' && applyState === 'running' && <Chip disabled>Applying…</Chip>}
          {phase === 'apply' && applyState === 'error' && (
            <>
              <Chip onClick={() => patchSession({ phase: 'emu' })}>Back</Chip>
              <Chip variant="action" onClick={() => void handleApplyGoldberg()}>
                Retry
              </Chip>
            </>
          )}
          {(phase === 'complete' || (phase === 'apply' && applyState === 'done')) && (
            <Chip variant="action" onClick={handleDone}>
              Done
            </Chip>
          )}

          {(phase === 'canceled' || phase === 'failed') && (
            <>
              <Chip
                onClick={() => {
                  onSessionChange(createEmptySession())
                  setErrorMsg('')
                }}
              >
                Start over
              </Chip>
              <Chip variant="action" onClick={onClose}>
                Close
              </Chip>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchStep({
  query,
  onQueryChange,
  searching,
  results,
  selected,
  onSelect
}: {
  query: string
  onQueryChange: (v: string) => void
  searching: boolean
  results: DepotSearchResult[]
  selected: DepotSearchResult | null
  onSelect: (r: DepotSearchResult) => void
}): React.ReactElement {
  return (
    <div className="depot-wizard__panel depot-wizard__panel--fill">
      <p className="depot-wizard__help">
        Search Steam for a game, then AchieveMe fetches its Hubcap manifest and downloads the
        selected depots with DepotDownloader.
      </p>
      <div className="depot-wizard__search-wrap">
        <AppSearchInput
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search games…"
          autoFocus
          autoComplete="off"
        />
        {searching && <span className="depot-wizard__muted depot-wizard__search-hint">Searching…</span>}
      </div>
      <ul className="depot-wizard__list">
        {results.map((r) => (
          <li key={r.gameId}>
            <button
              type="button"
              className={`depot-wizard__game-option${
                selected?.gameId === r.gameId ? ' depot-wizard__game-option--active' : ''
              }`}
              onClick={() => onSelect(r)}
            >
              {r.headerImageUrl ? (
                <img src={r.headerImageUrl} alt="" className="depot-wizard__thumb" />
              ) : (
                <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
              )}
              <span className="depot-wizard__game-text">
                <span className="depot-wizard__game-name">{r.gameName}</span>
                <span className="depot-wizard__game-meta">
                  AppID {r.gameId}
                  {r.releaseYear ? ` · ${r.releaseYear}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!searching && query.trim() && results.length === 0 && (
          <li className="depot-wizard__muted">No results found.</li>
        )}
      </ul>
    </div>
  )
}

function DepotsStep({
  gameData,
  headerImageUrl,
  selected,
  onToggle,
  outputPath,
  onBrowseOutput,
  selectedSize
}: {
  gameData: GameData
  headerImageUrl?: string
  selected: Record<string, boolean>
  onToggle: (id: string) => void
  outputPath: string
  onBrowseOutput: () => void
  selectedSize: number
}): React.ReactElement {
  const depotIds = Object.keys(gameData.depots)
  return (
    <div className="depot-wizard__panel depot-wizard__panel--fill">
      <div className="depot-wizard__game-banner">
        {headerImageUrl ? (
          <img src={headerImageUrl} alt="" className="depot-wizard__thumb" />
        ) : (
          <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
        )}
        <div>
          <div className="depot-wizard__game-name">{gameData.gameName}</div>
          <div className="depot-wizard__game-meta">AppID {gameData.appId}</div>
        </div>
      </div>
      <p className="depot-wizard__help">Select depots to download ({depotIds.length} available).</p>
      <ul className="depot-wizard__depot-list">
        {depotIds.map((id) => {
          const depot = gameData.depots[id]
          return (
            <li key={id}>
              <label className="depot-wizard__depot-row">
                <input
                  type="checkbox"
                  checked={Boolean(selected[id])}
                  onChange={() => onToggle(id)}
                  aria-label={`Depot ${id} ${depot.description}`}
                />
                <span className="depot-wizard__depot-info">
                  <span className="depot-wizard__game-name">{depot.description}</span>
                  <span className="depot-wizard__game-meta">
                    Depot {id} · {formatBytes(depot.size)}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <p className="depot-wizard__muted">Selected size: {formatBytes(selectedSize)}</p>
      <div className="depot-wizard__output-row">
        <input
          className="depot-wizard__output-input"
          readOnly
          value={outputPath}
          placeholder="Output folder (browse to choose)"
          aria-label="Output folder"
        />
        <Chip onClick={onBrowseOutput}>Browse…</Chip>
      </div>
    </div>
  )
}

function DownloadStep({
  session,
  logRef,
  onCancel,
  canCancel
}: {
  session: ActiveDepotSession
  logRef: React.RefObject<HTMLDivElement>
  onCancel: () => void
  canCancel: boolean
}): React.ReactElement {
  return (
    <div className="depot-wizard__panel depot-wizard__panel--fill">
      <div className="depot-wizard__game-banner">
        {session.headerImageUrl ? (
          <img src={session.headerImageUrl} alt="" className="depot-wizard__thumb" />
        ) : (
          <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
        )}
        <div>
          <div className="depot-wizard__game-name">{session.gameName}</div>
          <div className="depot-wizard__game-meta">{session.status || 'Downloading'}</div>
        </div>
      </div>
      <div
        className="depot-wizard__progress-track"
        role="progressbar"
        aria-valuenow={Math.round(session.pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="depot-wizard__progress-fill"
          style={{ width: `${Math.max(0, Math.min(100, session.pct))}%` }}
        />
      </div>
      <div className="depot-wizard__telemetry">
        <span>{Math.round(session.pct)}%</span>
        <span>{formatSpeed(session.speedBps)}</span>
        <span>ETA {formatEta(session.etaSec)}</span>
      </div>
      <div className="depot-wizard__log" ref={logRef} aria-live="polite">
        {session.logs.length === 0 && (
          <span className="depot-wizard__muted">Waiting for DepotDownloader output…</span>
        )}
        {session.logs.map((line, i) => (
          <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
        ))}
      </div>
      {canCancel && (
        <div className="depot-wizard__actions">
          <Chip onClick={onCancel}>Cancel</Chip>
        </div>
      )}
    </div>
  )
}

function DllStep({
  gameName,
  appId,
  headerImageUrl,
  dllInfo,
  onBrowse,
  errorMsg
}: {
  gameName: string
  appId: string
  headerImageUrl?: string
  dllInfo: SteamApiDllInfo | null
  onBrowse: () => void
  errorMsg: string
}): React.ReactElement {
  return (
    <div className="depot-wizard__panel">
      <div className="depot-wizard__game-banner">
        {headerImageUrl ? (
          <img src={headerImageUrl} alt="" className="depot-wizard__thumb" />
        ) : (
          <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
        )}
        <div>
          <div className="depot-wizard__game-name">{gameName}</div>
          <div className="depot-wizard__game-meta">AppID {appId}</div>
        </div>
      </div>
      <p className="depot-wizard__help">{ADD_GAME.dllHelp}</p>
      {dllInfo ? (
        <div className="depot-wizard__dll-found">
          <div className="depot-wizard__game-name">
            Found: {dllInfo.fileName}{' '}
            <span className="depot-wizard__game-meta">({dllInfo.architecture})</span>
          </div>
          <p className="depot-wizard__path" title={dllInfo.path}>
            {dllInfo.path}
          </p>
        </div>
      ) : (
        <p className="depot-wizard__muted">
          No steam_api.dll found under the download folder. Browse to select one.
        </p>
      )}
      <div className="depot-wizard__actions">
        <Chip variant="action" onClick={onBrowse}>
          Browse elsewhere…
        </Chip>
      </div>
      {errorMsg && (
        <p className="depot-wizard__error" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}

function EmuStep({
  gameName,
  appId,
  headerImageUrl,
  dllInfo,
  installEmuDll,
  onInstallEmuDllChange,
  denuvoOfflineActivated,
  onDenuvoOfflineActivatedChange
}: {
  gameName: string
  appId: string
  headerImageUrl?: string
  dllInfo: SteamApiDllInfo
  installEmuDll: boolean
  onInstallEmuDllChange: (value: boolean) => void
  denuvoOfflineActivated: boolean
  onDenuvoOfflineActivatedChange: (value: boolean) => void
}): React.ReactElement {
  return (
    <div className="depot-wizard__panel">
      <div className="depot-wizard__game-banner">
        {headerImageUrl ? (
          <img src={headerImageUrl} alt="" className="depot-wizard__thumb" />
        ) : (
          <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
        )}
        <div>
          <div className="depot-wizard__game-name">{gameName}</div>
          <div className="depot-wizard__game-meta">
            AppID {appId} · {dllInfo.fileName} ({dllInfo.architecture})
          </div>
        </div>
      </div>
      <p className="depot-wizard__help">{ADD_GAME.emuHelp}</p>
      <label className="depot-wizard__check">
        <input
          type="checkbox"
          checked={installEmuDll}
          onChange={(e) => onInstallEmuDllChange(e.target.checked)}
          aria-label={ADD_GAME.emuQuestion}
        />
        <span>{ADD_GAME.emuQuestion}</span>
      </label>
      <label className="depot-wizard__check">
        <input
          type="checkbox"
          checked={denuvoOfflineActivated}
          onChange={(e) => onDenuvoOfflineActivatedChange(e.target.checked)}
          aria-label={ADD_GAME.denuvoQuestion}
        />
        <span>{ADD_GAME.denuvoQuestion}</span>
      </label>
      {denuvoOfflineActivated && (
        <div className="depot-wizard__warning" role="status">
          {ADD_GAME.denuvoBackupWarning}
        </div>
      )}
    </div>
  )
}

function ApplyStep({
  gameName,
  appId,
  headerImageUrl,
  dllInfo,
  applyState,
  logLines,
  logRef,
  errorMsg
}: {
  gameName: string
  appId: string
  headerImageUrl?: string
  dllInfo: SteamApiDllInfo
  applyState: ApplyState
  logLines: string[]
  logRef: React.RefObject<HTMLDivElement>
  errorMsg: string
}): React.ReactElement {
  return (
    <div className="depot-wizard__panel depot-wizard__panel--fill">
      <div className="depot-wizard__game-banner">
        {headerImageUrl ? (
          <img src={headerImageUrl} alt="" className="depot-wizard__thumb" />
        ) : (
          <div className="depot-wizard__thumb depot-wizard__thumb--empty" />
        )}
        <div>
          <div className="depot-wizard__game-name">{gameName}</div>
          <div className="depot-wizard__game-meta">
            AppID {appId} · {dllInfo.fileName}
          </div>
        </div>
      </div>
      {applyState === 'idle' && <p className="depot-wizard__help">{ADD_GAME.applyHelp}</p>}
      {(applyState === 'running' || applyState === 'done' || applyState === 'error') && (
        <div className="depot-wizard__log" ref={logRef} aria-live="polite">
          {logLines.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
          ))}
          {applyState === 'running' && <div className="depot-wizard__muted">▌</div>}
        </div>
      )}
      {applyState === 'done' && (
        <p className="depot-wizard__ok">Game added successfully. Click Done to finish.</p>
      )}
      {applyState === 'error' && (
        <p className="depot-wizard__error" role="alert">
          Error: {errorMsg}
        </p>
      )}
    </div>
  )
}
