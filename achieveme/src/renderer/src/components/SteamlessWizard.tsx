import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { GameExecutable, GameSummary, SteamlessRunResult } from '../../../shared/types'
import { AppSearchInput, Chip } from './app'

type Step = 'pick-game' | 'pick-exe' | 'run' | 'done'

interface Props {
  onClose: () => void
}

function readinessLabel(game: GameSummary): string {
  if (game.launch_exe?.trim()) return 'Launch exe ready'
  if (game.install_path?.trim()) return 'Install folder set'
  return 'No install path'
}

export default function SteamlessWizard({ onClose }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('pick-game')
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null)
  const [exeOptions, setExeOptions] = useState<GameExecutable[]>([])
  const [targetExe, setTargetExe] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SteamlessRunResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [rootConfirmPath, setRootConfirmPath] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api
      .getAllGames()
      .then(setGames)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logLines])

  useEffect(() => {
    return () => {
      window.api.offSteamlessLog()
    }
  }, [])

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return games
    return games.filter(
      (g) => g.name.toLowerCase().includes(q) || g.appid.includes(q)
    )
  }, [games, search])

  async function goToRun(exePath: string): Promise<void> {
    setTargetExe(exePath)
    setStep('run')
    setErrorMsg('')
    setResult(null)
    setLogLines([])
    setRunning(true)
    window.api.offSteamlessLog()
    window.api.onSteamlessLog((line) => {
      setLogLines((prev) => [...prev, line])
    })
    try {
      const next = await window.api.runSteamless(exePath)
      setResult(next)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStep('done')
    } finally {
      setRunning(false)
      window.api.offSteamlessLog()
    }
  }

  async function handleBrowseExe(): Promise<void> {
    setErrorMsg('')
    try {
      const picked = await window.api.browseSteamlessExe()
      if (!picked) return
      setSelectedGame(null)
      await goToRun(picked)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function loadExeListForGame(game: GameSummary, acceptedRoot?: string): Promise<void> {
    setErrorMsg('')
    setRootConfirmPath(null)
    const resolved = await window.api.resolveGameExecutables(game.appid, acceptedRoot)
    if (resolved.status === 'confirm_root') {
      setRootConfirmPath(resolved.candidatePath)
      return
    }
    if (resolved.status === 'need_browse') {
      const picked = await window.api.browseSteamlessExe()
      if (picked) await goToRun(picked)
      return
    }
    if (resolved.executables.length === 1) {
      await goToRun(resolved.executables[0].absolutePath)
      return
    }
    setExeOptions(resolved.executables)
    setStep('pick-exe')
    if (resolved.executables.length === 0) {
      setErrorMsg('No executables found under the game folder.')
    }
  }

  async function handleSelectGame(game: GameSummary): Promise<void> {
    setSelectedGame(game)
    setErrorMsg('')
    setExeOptions([])
    const launchExe = game.launch_exe?.trim() ?? ''
    if (launchExe) {
      await goToRun(launchExe)
      return
    }
    const installPath = game.install_path?.trim() ?? ''
    if (installPath) {
      await loadExeListForGame(game)
      return
    }
    const picked = await window.api.browseSteamlessExe()
    if (picked) await goToRun(picked)
  }

  async function handleConfirmRoot(yes: boolean): Promise<void> {
    const candidate = rootConfirmPath
    setRootConfirmPath(null)
    if (!selectedGame || !candidate) return
    if (yes) {
      await loadExeListForGame(selectedGame, candidate)
      return
    }
    const picked = await window.api.browseSteamlessExe()
    if (picked) await goToRun(picked)
  }

  return (
    <div
      className="steamless-wizard-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div
        className="steamless-wizard"
        role="dialog"
        aria-modal="true"
        aria-label="Steamless unpack wizard"
      >
        <div className="steamless-wizard__header">
          <h2 className="steamless-wizard__title">
            {step === 'pick-game' && 'Steamless — Pick game'}
            {step === 'pick-exe' && 'Steamless — Pick executable'}
            {step === 'run' && 'Steamless — Unpacking…'}
            {step === 'done' && 'Steamless — Done'}
          </h2>
          <button
            type="button"
            className="steamless-wizard__close"
            onClick={onClose}
            disabled={running}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <p className="steamless-wizard__error" role="alert">
            {errorMsg}
          </p>
        )}

        {rootConfirmPath && (
          <div className="steamless-wizard__confirm">
            <p className="steamless-wizard__help">Is this the game&apos;s folder?</p>
            <p className="steamless-wizard__path" title={rootConfirmPath}>
              {rootConfirmPath}
            </p>
            <div className="steamless-wizard__actions">
              <Chip variant="action" onClick={() => void handleConfirmRoot(true)}>
                Yes, use this folder
              </Chip>
              <Chip onClick={() => void handleConfirmRoot(false)}>No, browse…</Chip>
            </div>
          </div>
        )}

        {step === 'pick-game' && !rootConfirmPath && (
          <>
            <p className="steamless-wizard__help">
              Choose a library game. Prefer games with a launch exe or install folder already set.
              Or search for any .exe on disk.
            </p>
            <AppSearchInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library games…"
              autoComplete="off"
            />
            {loading ? (
              <p className="steamless-wizard__muted">Loading games…</p>
            ) : (
              <ul className="steamless-wizard__game-list">
                {filteredGames.map((game) => (
                  <li key={game.appid}>
                    <button
                      type="button"
                      className="steamless-wizard__game-option"
                      onClick={() => void handleSelectGame(game)}
                    >
                      <span className="steamless-wizard__game-name">{game.name}</span>
                      <span className="steamless-wizard__game-meta">{readinessLabel(game)}</span>
                    </button>
                  </li>
                ))}
                {filteredGames.length === 0 && (
                  <li className="steamless-wizard__muted">No games match.</li>
                )}
              </ul>
            )}
            <div className="steamless-wizard__actions">
              <Chip variant="action" onClick={() => void handleBrowseExe()}>
                Search for executable…
              </Chip>
            </div>
          </>
        )}

        {step === 'pick-exe' && (
          <>
            <p className="steamless-wizard__help">
              Select the .exe to unpack for {selectedGame?.name ?? 'this game'}.
            </p>
            <ul className="steamless-wizard__game-list">
              {exeOptions.map((exe) => (
                <li key={exe.absolutePath}>
                  <button
                    type="button"
                    className="steamless-wizard__game-option"
                    onClick={() => void goToRun(exe.absolutePath)}
                  >
                    <span className="steamless-wizard__game-name">{exe.name}</span>
                    <span className="steamless-wizard__game-meta">{exe.relativePath}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="steamless-wizard__actions">
              <Chip onClick={() => setStep('pick-game')}>Back</Chip>
              <Chip onClick={() => void handleBrowseExe()}>Browse for .exe…</Chip>
            </div>
          </>
        )}

        {(step === 'run' || step === 'done') && (
          <>
            {targetExe && (
              <p className="steamless-wizard__path" title={targetExe}>
                {targetExe}
              </p>
            )}
            <div className="steamless-wizard__log" ref={logRef} aria-live="polite">
              {logLines.length === 0 && running && (
                <span className="steamless-wizard__muted">Running Steamless.CLI…</span>
              )}
              {logLines.map((line, i) => (
                <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
              ))}
              {result?.log && logLines.length === 0 && (
                <pre className="steamless-wizard__log-pre">{result.log}</pre>
              )}
            </div>
            {step === 'done' && result && (
              <div className="steamless-wizard__result">
                <p className={result.ok ? 'steamless-wizard__ok' : 'steamless-wizard__error'}>
                  {result.ok
                    ? 'Successfully unpacked file.'
                    : `Unpack failed (exit ${result.exitCode}).`}
                </p>
                {result.unpackedPath && (
                  <p className="steamless-wizard__path" title={result.unpackedPath}>
                    Output: {result.unpackedPath}
                  </p>
                )}
              </div>
            )}
            {step === 'done' && (
              <div className="steamless-wizard__actions">
                <Chip
                  onClick={() => {
                    setStep('pick-game')
                    setResult(null)
                    setLogLines([])
                    setTargetExe('')
                    setErrorMsg('')
                    setSelectedGame(null)
                  }}
                >
                  Unpack another
                </Chip>
                <Chip variant="action" onClick={onClose}>
                  Close
                </Chip>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
