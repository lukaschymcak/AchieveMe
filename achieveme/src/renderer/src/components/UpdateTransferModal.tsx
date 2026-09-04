import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveUpdateSession, GameData } from '../../../shared/types'
import { parseManifestGidsJson } from '../../../shared/manifestUpdateUtils'
import { nextReapplyTool, type ReapplyToolId } from '../../../shared/reapplyToolsUtils'
import { Chip } from './app'

interface Props {
  session: ActiveUpdateSession
  manifestGidsJson: string
  onSessionChange: (session: ActiveUpdateSession | null) => void
  onConfirmDepots: (selectedDepots: string[]) => void
  onClose: () => void
  onDismissComplete: () => void
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

/**
 * Update/Validate transfer modal: depot pick, live progress, optional tool reapply.
 * Closing does not cancel the job — reopen from the Transfers dock.
 */
export default function UpdateTransferModal({
  session,
  manifestGidsJson,
  onSessionChange,
  onConfirmDepots,
  onClose,
  onDismissComplete
}: Props): React.ReactElement {
  const phase = session.phase
  const modeLabel = session.mode === 'validate' ? 'Validate' : 'Update'

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loadingDepots, setLoadingDepots] = useState(false)
  const [pickError, setPickError] = useState('')

  const [includeSteamless, setIncludeSteamless] = useState(session.steamlessApplied)
  const [includeGoldberg, setIncludeGoldberg] = useState(session.goldbergApplied)
  const [steamlessExe, setSteamlessExe] = useState(
    session.steamlessExe?.trim() || ''
  )
  const [goldbergDll, setGoldbergDll] = useState(session.goldbergDllPath?.trim() || '')
  const [steamlessFolderMissing, setSteamlessFolderMissing] = useState(false)
  const [reapplyCompleted, setReapplyCompleted] = useState<ReapplyToolId[]>([])
  const [currentTool, setCurrentTool] = useState<ReapplyToolId | null>(null)
  const [reapplyLogs, setReapplyLogs] = useState<string[]>([])
  const [reapplyError, setReapplyError] = useState('')
  const [reapplyRunning, setReapplyRunning] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef<ReapplyToolId[]>([])
  completedRef.current = reapplyCompleted

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [reapplyLogs, session.label])

  useEffect(() => {
    if (phase !== 'pick_depots') return
    let cancelled = false
    setLoadingDepots(true)
    setPickError('')
    void window.api
      .manifestGetGameData(session.appid, session.mode === 'update')
      .then((gd) => {
        if (cancelled) return
        setGameData(gd)
        const storedKeys = new Set(Object.keys(parseManifestGidsJson(manifestGidsJson)))
        const initial: Record<string, boolean> = {}
        for (const id of Object.keys(gd.depots)) {
          initial[id] = storedKeys.has(id)
        }
        setSelected(initial)
      })
      .catch((err) => {
        if (cancelled) return
        setPickError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoadingDepots(false)
      })
    return () => {
      cancelled = true
    }
  }, [phase, session.appid, session.mode, manifestGidsJson])

  useEffect(() => {
    if (phase !== 'reapply_ask' && phase !== 'reapply_pick') return
    let cancelled = false
    void (async () => {
      try {
        const settings = await window.api.getSettings()
        if (!cancelled) {
          setSteamlessFolderMissing(!(settings.steamlessFolder?.trim()))
        }
      } catch {
        if (!cancelled) setSteamlessFolderMissing(true)
      }
      if (session.goldbergApplied && !goldbergDll.trim() && session.installPath.trim()) {
        try {
          const found = await window.api.depotScanDll(session.installPath.trim())
          if (!cancelled && found?.path) setGoldbergDll(found.path)
        } catch {
          // browse later
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, session.goldbergApplied, session.installPath, goldbergDll])

  const selectedDepotIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  )

  const title =
    phase === 'pick_depots'
      ? `Select depots to ${session.mode}`
      : phase.startsWith('reapply')
        ? 'Reapply tools'
        : phase === 'error'
          ? `${modeLabel} failed`
          : phase === 'done'
            ? `${modeLabel} complete`
            : `${modeLabel} — ${session.gameName || session.appid}`

  const canApplyReapply =
    !reapplyRunning &&
    (includeSteamless || includeGoldberg) &&
    (!includeSteamless || (steamlessExe.trim() !== '' && !steamlessFolderMissing)) &&
    (!includeGoldberg || goldbergDll.trim() !== '')

  function patch(partial: Partial<ActiveUpdateSession>): void {
    onSessionChange({ ...session, ...partial })
  }

  async function runNextReapply(fromCompleted: ReapplyToolId[]): Promise<void> {
    const next = nextReapplyTool({
      includeSteamless,
      includeGoldberg,
      completed: fromCompleted
    })
    if (next === 'done') {
      setCurrentTool(null)
      setReapplyRunning(false)
      patch({ phase: 'done', busy: false, label: 'Tools reapplied' })
      return
    }

    setCurrentTool(next)
    setReapplyRunning(true)
    setReapplyError('')
    patch({ phase: 'reapply_run', busy: false, label: `Running ${next}…` })

    if (next === 'steamless') {
      window.api.offSteamlessLog()
      window.api.onSteamlessLog((line) => {
        setReapplyLogs((prev) => [...prev, line])
      })
      try {
        const result = await window.api.runSteamless(steamlessExe.trim(), session.appid)
        window.api.offSteamlessLog()
        if (!result.ok) {
          setReapplyError(result.log?.trim() || `Steamless failed (exit ${result.exitCode}).`)
          setReapplyRunning(false)
          patch({ phase: 'reapply_run', error: 'Steamless failed' })
          return
        }
        const after = [...fromCompleted, 'steamless' as const]
        setReapplyCompleted(after)
        await runNextReapply(after)
      } catch (err) {
        window.api.offSteamlessLog()
        setReapplyError(err instanceof Error ? err.message : String(err))
        setReapplyRunning(false)
      }
      return
    }

    window.api.offGoldbergLog()
    window.api.onGoldbergLog((line) => {
      setReapplyLogs((prev) => [...prev, line])
    })
    try {
      await window.api.applyGoldberg({
        appid: session.appid,
        dllPath: goldbergDll.trim(),
        installEmuDll: true,
        denuvoOfflineActivated: false
      })
      window.api.offGoldbergLog()
      const after = [...fromCompleted, 'goldberg' as const]
      setReapplyCompleted(after)
      await runNextReapply(after)
    } catch (err) {
      window.api.offGoldbergLog()
      setReapplyError(err instanceof Error ? err.message : String(err))
      setReapplyRunning(false)
    }
  }

  return (
    <div className="update-transfer-backdrop" role="presentation">
      <div
        className="update-transfer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="update-transfer__header">
          <h2 className="update-transfer__title">{title}</h2>
          <button
            type="button"
            className="update-transfer__close"
            onClick={onClose}
            disabled={reapplyRunning}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="update-transfer__body">
          {phase === 'pick_depots' && (
            <div className="update-transfer__panel">
              <p className="update-transfer__help">
                {session.gameName} — choose depots to {session.mode}. Closing keeps nothing running
                until you confirm.
              </p>
              {loadingDepots && <p className="update-transfer__muted">Loading depots…</p>}
              {pickError && (
                <p className="update-transfer__error" role="alert">
                  {pickError}
                </p>
              )}
              {gameData && (
                <ul className="update-transfer__depot-list">
                  {Object.keys(gameData.depots).map((id) => {
                    const depot = gameData.depots[id]
                    return (
                      <li key={id}>
                        <label className="update-transfer__depot-row">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[id])}
                            onChange={() =>
                              setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
                            }
                            aria-label={`Depot ${id} ${depot.description}`}
                          />
                          <span>
                            <span className="update-transfer__depot-name">{depot.description}</span>
                            <span className="update-transfer__muted">
                              Depot {id} · {formatBytes(depot.size)}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {(phase === 'running' || phase === 'error') && (
            <div className="update-transfer__panel">
              <p className="update-transfer__help">
                {session.label || (session.mode === 'validate' ? 'Validating…' : 'Updating…')}
              </p>
              <div
                className="update-transfer__progress-track"
                role="progressbar"
                aria-valuenow={Math.round(session.pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="update-transfer__progress-fill"
                  style={{ width: `${Math.max(0, Math.min(100, session.pct))}%` }}
                />
              </div>
              <p className="update-transfer__muted">{Math.round(session.pct)}%</p>
              {session.error && (
                <p className="update-transfer__error" role="alert">
                  {session.error}
                </p>
              )}
              <p className="update-transfer__muted">
                You can close this window — progress continues in Transfers.
              </p>
            </div>
          )}

          {phase === 'reapply_ask' && (
            <div className="update-transfer__panel">
              <p className="update-transfer__help">
                {session.gameName} had{' '}
                {[
                  session.steamlessApplied ? 'Steamless' : null,
                  session.goldbergApplied ? 'Goldberg' : null
                ]
                  .filter(Boolean)
                  .join(' and ')}{' '}
                applied. Reapply after the update?
              </p>
              <p className="update-transfer__muted">
                Nothing runs automatically — you pick paths and confirm Apply.
              </p>
            </div>
          )}

          {(phase === 'reapply_pick' || (phase === 'reapply_run' && reapplyError)) && (
            <div className="update-transfer__panel">
              <p className="update-transfer__help">
                Check tools to reapply. Steamless runs before Goldberg.
              </p>
              {session.steamlessApplied && (
                <div className="update-transfer__tool">
                  <label className="update-transfer__check">
                    <input
                      type="checkbox"
                      checked={includeSteamless}
                      onChange={(e) => setIncludeSteamless(e.target.checked)}
                      aria-label="Reapply Steamless"
                    />
                    <span>Steamless</span>
                  </label>
                  {includeSteamless && (
                    <>
                      <input
                        className="update-transfer__path-input"
                        readOnly
                        value={steamlessExe}
                        placeholder="Game executable (.exe)"
                        aria-label="Steamless target executable"
                      />
                      <Chip
                        onClick={() => {
                          void window.api.browseSteamlessExe().then((p) => {
                            if (p) setSteamlessExe(p)
                          })
                        }}
                      >
                        Browse…
                      </Chip>
                      {steamlessFolderMissing && (
                        <p className="update-transfer__error" role="alert">
                          Link a Steamless folder in Settings → External tools first.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              {session.goldbergApplied && (
                <div className="update-transfer__tool">
                  <label className="update-transfer__check">
                    <input
                      type="checkbox"
                      checked={includeGoldberg}
                      onChange={(e) => setIncludeGoldberg(e.target.checked)}
                      aria-label="Reapply Goldberg"
                    />
                    <span>Goldberg</span>
                  </label>
                  {includeGoldberg && (
                    <>
                      <input
                        className="update-transfer__path-input"
                        readOnly
                        value={goldbergDll}
                        placeholder="steam_api.dll / steam_api64.dll"
                        aria-label="Goldberg DLL path"
                      />
                      <Chip
                        onClick={() => {
                          void window.api.browseDllPath().then((info) => {
                            if (info?.path) setGoldbergDll(info.path)
                          })
                        }}
                      >
                        Browse…
                      </Chip>
                    </>
                  )}
                </div>
              )}
              {reapplyError && (
                <p className="update-transfer__error" role="alert">
                  {reapplyError}
                </p>
              )}
            </div>
          )}

          {phase === 'reapply_run' && !reapplyError && (
            <div className="update-transfer__panel">
              <p className="update-transfer__help">
                {currentTool
                  ? `Running ${currentTool === 'steamless' ? 'Steamless' : 'Goldberg'}…`
                  : 'Working…'}
              </p>
              <div className="update-transfer__log" ref={logRef} aria-live="polite">
                {reapplyLogs.map((line, i) => (
                  <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="update-transfer__panel">
              <p className="update-transfer__ok">
                {session.label?.trim() || `${modeLabel} finished.`}
              </p>
            </div>
          )}
        </div>

        <div className="update-transfer__footer">
          {phase === 'pick_depots' && (
            <>
              <Chip onClick={onClose}>Close</Chip>
              <Chip
                variant="action"
                disabled={loadingDepots || selectedDepotIds.length === 0}
                onClick={() => onConfirmDepots(selectedDepotIds)}
              >
                Confirm
              </Chip>
            </>
          )}

          {phase === 'running' && <Chip onClick={onClose}>Hide</Chip>}

          {phase === 'error' && (
            <>
              <Chip onClick={onDismissComplete}>Dismiss</Chip>
              <Chip onClick={onClose}>Hide</Chip>
            </>
          )}

          {phase === 'reapply_ask' && (
            <>
              <Chip onClick={onDismissComplete}>Skip</Chip>
              <Chip
                variant="action"
                onClick={() => {
                  setIncludeSteamless(session.steamlessApplied)
                  setIncludeGoldberg(session.goldbergApplied)
                  patch({ phase: 'reapply_pick' })
                }}
              >
                Reapply
              </Chip>
            </>
          )}

          {phase === 'reapply_pick' && (
            <>
              <Chip onClick={() => patch({ phase: 'reapply_ask' })}>Back</Chip>
              <Chip onClick={onDismissComplete}>Skip</Chip>
              <Chip
                variant="action"
                disabled={!canApplyReapply}
                onClick={() => {
                  setReapplyLogs([])
                  setReapplyCompleted([])
                  completedRef.current = []
                  void runNextReapply([])
                }}
              >
                Apply
              </Chip>
            </>
          )}

          {phase === 'reapply_run' && reapplyRunning && <Chip disabled>Working…</Chip>}
          {phase === 'reapply_run' && !reapplyRunning && reapplyError && (
            <>
              <Chip
                onClick={() => {
                  setReapplyError('')
                  patch({ phase: 'reapply_pick', error: '' })
                }}
              >
                Back
              </Chip>
              <Chip
                variant="action"
                onClick={() => {
                  setReapplyError('')
                  setReapplyLogs([])
                  void runNextReapply(completedRef.current)
                }}
              >
                Retry
              </Chip>
            </>
          )}

          {phase === 'done' && (
            <Chip variant="action" onClick={onDismissComplete}>
              Done
            </Chip>
          )}
        </div>
      </div>
    </div>
  )
}
