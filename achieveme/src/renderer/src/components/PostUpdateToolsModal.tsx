import React, { useEffect, useRef, useState } from 'react'
import type { Game } from '../../../shared/types'
import { nextReapplyTool, type ReapplyToolId } from '../../../shared/reapplyToolsUtils'
import { Chip } from './app'

type Step = 'ask' | 'pick' | 'run' | 'done'

type ApplyState = 'idle' | 'running' | 'error' | 'done'

interface Props {
  game: Game
  onClose: () => void
}

/**
 * Post-update confirm + picker + sequential Steamless → Goldberg reapply.
 * Never auto-applies; stop on first failure with Retry.
 */
export default function PostUpdateToolsModal({ game, onClose }: Props): React.ReactElement {
  const hadSteamless = game.steamless_applied === 1
  const hadGoldberg = game.goldberg_applied === 1

  const [step, setStep] = useState<Step>('ask')
  const [includeSteamless, setIncludeSteamless] = useState(hadSteamless)
  const [includeGoldberg, setIncludeGoldberg] = useState(hadGoldberg)
  const [steamlessExe, setSteamlessExe] = useState(game.steamless_exe?.trim() || game.launch_exe?.trim() || '')
  const [goldbergDll, setGoldbergDll] = useState(game.goldberg_dll_path?.trim() || '')
  const [steamlessFolderMissing, setSteamlessFolderMissing] = useState(false)
  const [applyState, setApplyState] = useState<ApplyState>('idle')
  const [completed, setCompleted] = useState<ReapplyToolId[]>([])
  const [currentTool, setCurrentTool] = useState<ReapplyToolId | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef<ReapplyToolId[]>([])
  completedRef.current = completed

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logLines])

  useEffect(() => {
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

      if (hadGoldberg && !game.goldberg_dll_path?.trim() && game.install_path?.trim()) {
        try {
          const found = await window.api.depotScanDll(game.install_path.trim())
          if (!cancelled && found?.path) setGoldbergDll(found.path)
        } catch {
          // leave empty — user can browse
        }
      }
    })()
    return () => {
      cancelled = true
      window.api.offSteamlessLog()
      window.api.offGoldbergLog()
    }
  }, [game.goldberg_dll_path, game.install_path, hadGoldberg])

  const toolLabels = [
    hadSteamless ? 'Steamless' : null,
    hadGoldberg ? 'Goldberg' : null
  ]
    .filter(Boolean)
    .join(' and ')

  const canApply =
    applyState !== 'running' &&
    (includeSteamless || includeGoldberg) &&
    (!includeSteamless || (steamlessExe.trim() !== '' && !steamlessFolderMissing)) &&
    (!includeGoldberg || goldbergDll.trim() !== '')

  async function handleBrowseExe(): Promise<void> {
    setErrorMsg('')
    try {
      const picked = await window.api.browseSteamlessExe()
      if (picked) setSteamlessExe(picked)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleBrowseDll(): Promise<void> {
    setErrorMsg('')
    try {
      const info = await window.api.browseDllPath()
      if (info?.path) setGoldbergDll(info.path)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function runNext(fromCompleted: ReapplyToolId[]): Promise<void> {
    const next = nextReapplyTool({
      includeSteamless,
      includeGoldberg,
      completed: fromCompleted
    })
    if (next === 'done') {
      setCurrentTool(null)
      setApplyState('done')
      setStep('done')
      return
    }

    setCurrentTool(next)
    setApplyState('running')
    setErrorMsg('')

    if (next === 'steamless') {
      window.api.offSteamlessLog()
      window.api.onSteamlessLog((line) => {
        setLogLines((prev) => [...prev, line])
      })
      try {
        const result = await window.api.runSteamless(steamlessExe.trim(), game.appid)
        window.api.offSteamlessLog()
        if (!result.ok) {
          setErrorMsg(result.log?.trim() || `Steamless failed (exit ${result.exitCode}).`)
          setApplyState('error')
          setStep('run')
          return
        }
        const after = [...fromCompleted, 'steamless' as const]
        setCompleted(after)
        await runNext(after)
      } catch (err) {
        window.api.offSteamlessLog()
        setErrorMsg(err instanceof Error ? err.message : String(err))
        setApplyState('error')
        setStep('run')
      }
      return
    }

    window.api.offGoldbergLog()
    window.api.onGoldbergLog((line) => {
      setLogLines((prev) => [...prev, line])
    })
    try {
      await window.api.applyGoldberg({
        appid: game.appid,
        dllPath: goldbergDll.trim(),
        installEmuDll: true,
        denuvoOfflineActivated: false
      })
      window.api.offGoldbergLog()
      const after = [...fromCompleted, 'goldberg' as const]
      setCompleted(after)
      await runNext(after)
    } catch (err) {
      window.api.offGoldbergLog()
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setApplyState('error')
      setStep('run')
    }
  }

  async function handleApply(): Promise<void> {
    if (!canApply) return
    setStep('run')
    setLogLines([])
    setCompleted([])
    completedRef.current = []
    await runNext([])
  }

  async function handleRetry(): Promise<void> {
    setErrorMsg('')
    setLogLines([])
    await runNext(completedRef.current)
  }

  return (
    <div
      className="post-update-tools-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && applyState !== 'running') onClose()
      }}
    >
      <div
        className="post-update-tools"
        role="dialog"
        aria-modal="true"
        aria-label="Reapply tools after update"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="post-update-tools__header">
          <h2 className="post-update-tools__title">
            {step === 'ask'
              ? 'Reapply tools?'
              : step === 'pick'
                ? 'Choose tools to reapply'
                : step === 'done'
                  ? 'Tools reapplied'
                  : 'Reapplying tools'}
          </h2>
          <button
            type="button"
            className="post-update-tools__close"
            onClick={onClose}
            disabled={applyState === 'running'}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="post-update-tools__body">
          {step === 'ask' && (
            <div className="post-update-tools__panel">
              <p className="post-update-tools__help">
                {game.name} had {toolLabels} applied. Reapply after the update?
              </p>
              <p className="post-update-tools__muted">
                Nothing runs automatically — you pick paths and confirm Apply.
              </p>
            </div>
          )}

          {step === 'pick' && (
            <div className="post-update-tools__panel">
              <p className="post-update-tools__help">
                Check the tools to reapply, confirm paths, then Apply. Steamless runs before Goldberg.
              </p>

              {hadSteamless && (
                <div className="post-update-tools__tool">
                  <label className="post-update-tools__check">
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
                        className="post-update-tools__path-input"
                        readOnly
                        value={steamlessExe}
                        placeholder="Game executable (.exe)"
                        aria-label="Steamless target executable"
                      />
                      <div className="post-update-tools__row-actions">
                        <Chip onClick={() => void handleBrowseExe()}>Browse…</Chip>
                      </div>
                      {steamlessFolderMissing && (
                        <p className="post-update-tools__error" role="alert">
                          Link a Steamless folder in Settings → External tools first.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {hadGoldberg && (
                <div className="post-update-tools__tool">
                  <label className="post-update-tools__check">
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
                        className="post-update-tools__path-input"
                        readOnly
                        value={goldbergDll}
                        placeholder="steam_api.dll / steam_api64.dll"
                        aria-label="Goldberg steam_api DLL path"
                      />
                      <div className="post-update-tools__row-actions">
                        <Chip onClick={() => void handleBrowseDll()}>Browse…</Chip>
                      </div>
                    </>
                  )}
                </div>
              )}

              {errorMsg && (
                <p className="post-update-tools__error" role="alert">
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          {(step === 'run' || step === 'done') && (
            <div className="post-update-tools__panel">
              {currentTool && applyState === 'running' && (
                <p className="post-update-tools__help">
                  Running {currentTool === 'steamless' ? 'Steamless' : 'Goldberg'}…
                </p>
              )}
              {applyState === 'done' && (
                <p className="post-update-tools__ok">Finished reapplying selected tools.</p>
              )}
              {errorMsg && (
                <p className="post-update-tools__error" role="alert">
                  {errorMsg}
                </p>
              )}
              <div className="post-update-tools__log" ref={logRef} aria-live="polite">
                {logLines.length === 0 && applyState === 'running' && (
                  <span className="post-update-tools__muted">Waiting for output…</span>
                )}
                {logLines.map((line, i) => (
                  <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="post-update-tools__footer">
          {step === 'ask' && (
            <>
              <Chip onClick={onClose}>Skip</Chip>
              <Chip
                variant="action"
                onClick={() => {
                  setErrorMsg('')
                  setStep('pick')
                }}
              >
                Reapply
              </Chip>
            </>
          )}

          {step === 'pick' && (
            <>
              <Chip onClick={() => setStep('ask')}>Back</Chip>
              <Chip onClick={onClose}>Skip</Chip>
              <Chip variant="action" disabled={!canApply} onClick={() => void handleApply()}>
                Apply
              </Chip>
            </>
          )}

          {step === 'run' && applyState === 'running' && <Chip disabled>Working…</Chip>}
          {step === 'run' && applyState === 'error' && (
            <>
              <Chip
                onClick={() => {
                  setApplyState('idle')
                  setErrorMsg('')
                  setStep('pick')
                }}
              >
                Back
              </Chip>
              <Chip variant="action" onClick={() => void handleRetry()}>
                Retry
              </Chip>
            </>
          )}
          {step === 'done' && (
            <Chip variant="action" onClick={onClose}>
              Done
            </Chip>
          )}
        </div>
      </div>
    </div>
  )
}
