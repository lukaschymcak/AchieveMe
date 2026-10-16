import React, { useState } from 'react'
import type { SteamApiDllInfo } from '../../../shared/types'
import { chooseReapplyDllPath } from '../../../shared/goldbergReapplyUtils.ts'

interface Props {
  appid: string
  installPath: string
  savedDllPath: string
  onClose: () => void
  onApplied: () => void
}

type Step = 'ask' | 'pick' | 'run'

/**
 * Asks whether to include achievements, finds the Steam API DLL, and reapplies Goldberg.
 */
export default function ReapplyGoldbergDialog({
  appid,
  installPath,
  savedDllPath,
  onClose,
  onApplied
}: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('ask')
  const [includeAchievements, setIncludeAchievements] = useState(true)
  const [dllPath, setDllPath] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  async function begin(include: boolean): Promise<void> {
    setIncludeAchievements(include)
    setError('')
    let scanned = ''
    if (installPath.trim()) {
      try {
        const found = await window.api.depotScanDll(installPath.trim())
        scanned = found?.path ?? ''
      } catch {
        scanned = ''
      }
    }
    const chosen = chooseReapplyDllPath(savedDllPath, scanned)
    if (!chosen) {
      setStep('pick')
      return
    }
    await run(include, chosen)
  }

  async function run(include: boolean, dll: string): Promise<void> {
    setStep('run')
    setRunning(true)
    setError('')
    try {
      await window.api.applyGoldberg({
        appid,
        dllPath: dll,
        installEmuDll: true,
        denuvoOfflineActivated: false,
        includeAchievements: include
      })
      onApplied()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/Steam API DLL was not found/i.test(message)) {
        setDllPath('')
        setError('')
        setStep('pick')
        setRunning(false)
        return
      }
      setError(message)
      setRunning(false)
    }
  }

  function handleClose(): void {
    if (running) void window.api.cancelGoldberg()
    onClose()
  }

  function handleBrowse(): void {
    void window.api.browseDllPath().then((info: SteamApiDllInfo | null) => {
      if (info?.path) {
        setDllPath(info.path)
        setError('')
      }
    })
  }

  return (
    <div
      className="game-detail__exe-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) handleClose()
      }}
    >
      <div
        className="game-detail__exe-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reapply-goldberg-title"
      >
        <div className="game-detail__exe-modal-header">
          <h3 id="reapply-goldberg-title" className="game-detail__exe-modal-title">
            Reapply Goldberg
          </h3>
          <button
            type="button"
            className="game-detail__pill"
            onClick={handleClose}
            disabled={running}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === 'ask' && (
          <>
            <p className="game-detail__exe-modal-help">Include achievements?</p>
            <div className="game-detail__exe-confirm-actions">
              <button
                type="button"
                className="game-detail__pill game-detail__play"
                onClick={() => void begin(true)}
              >
                Yes
              </button>
              <button type="button" className="game-detail__pill" onClick={() => void begin(false)}>
                No
              </button>
            </div>
          </>
        )}

        {step === 'pick' && (
          <>
            <p className="game-detail__exe-modal-help">
              Pick steam_api.dll or steam_api64.dll in the game folder.
            </p>
            <div className="game-detail__exe-modal-path-row">
              <span className="game-detail__exe-modal-path" title={dllPath}>
                {dllPath || 'No DLL selected'}
              </span>
              <button type="button" className="game-detail__pill" onClick={handleBrowse}>
                Browse…
              </button>
            </div>
            <div className="game-detail__exe-confirm-actions">
              <button type="button" className="game-detail__pill" onClick={() => setStep('ask')}>
                Back
              </button>
              <button
                type="button"
                className="game-detail__pill game-detail__play"
                disabled={!dllPath.trim()}
                onClick={() => void run(includeAchievements, dllPath.trim())}
              >
                Apply
              </button>
            </div>
          </>
        )}

        {step === 'run' && (
          <>
            <p className="game-detail__exe-modal-help">
              {running ? 'Applying Goldberg…' : error ? 'Goldberg failed.' : 'Working…'}
            </p>
            {running && (
              <div className="game-detail__reapply-spinner-wrap">
                <span className="game-detail__save-spinner game-detail__reapply-spinner" aria-hidden />
              </div>
            )}
            {error && (
              <p className="game-detail__exe-modal-error" role="alert">
                {error}
              </p>
            )}
            {!running && error && (
              <div className="game-detail__exe-confirm-actions">
                <button type="button" className="game-detail__pill" onClick={handleClose}>
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
