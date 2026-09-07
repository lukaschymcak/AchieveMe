import React, { useEffect, useState } from 'react'
import { bucketDepotsForScan } from '../../../shared/depotOsClassifyUtils'
import { pickManifestGids } from '../../../shared/manifestUpdateUtils'
import type { GameData, ScannedInstallCandidate } from '../../../shared/types'
import { Chip } from './app'

type PickerQueueItem = {
  appid: string
  gameName: string
  installPath: string
  gameData: GameData
  autoKeepIds: string[]
  unsureIds: string[]
}

interface Props {
  onClose: () => void
  onImported: () => void
}

/**
 * Tools modal: scan installScanRoots / browsed folders and add selected installs.
 */
export default function InstalledGamesScanModal({
  onClose,
  onImported
}: Props): React.ReactElement {
  const [roots, setRoots] = useState<string[]>([])
  const [includeIgnored, setIncludeIgnored] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [candidates, setCandidates] = useState<ScannedInstallCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [pickerQueue, setPickerQueue] = useState<PickerQueueItem[]>([])
  const [pickerIndex, setPickerIndex] = useState(0)
  const [pickerChecked, setPickerChecked] = useState<Record<string, boolean>>({})
  const [pickerError, setPickerError] = useState('')
  const [pickerSaving, setPickerSaving] = useState(false)
  const [batchErrors, setBatchErrors] = useState<string[]>([])

  const pickerActive = pickerQueue.length > 0 && pickerIndex < pickerQueue.length
  const pickerItem = pickerActive ? pickerQueue[pickerIndex] : null

  useEffect(() => {
    if (!pickerActive) return
    const item = pickerQueue[pickerIndex]
    if (!item) return
    const next: Record<string, boolean> = {}
    for (const id of item.autoKeepIds) next[id] = true
    for (const id of item.unsureIds) next[id] = false
    setPickerChecked(next)
    setPickerError('')
  }, [pickerActive, pickerIndex, pickerQueue])

  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setRoots([...(s.installScanRoots ?? [])])
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleScan(): Promise<void> {
    setScanning(true)
    setErrorMsg('')
    setStatusMsg('')
    try {
      const found = await window.api.scanInstalledGames(roots, { includeIgnored })
      setCandidates(found)
      setSelected(new Set(found.filter((c) => !c.alreadyInLibrary).map((c) => c.appid)))
      setStatusMsg(
        found.length === 0
          ? 'No Steam-shaped installs found in the configured roots.'
          : `Found ${found.length} install${found.length === 1 ? '' : 's'}.`
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setCandidates([])
      setSelected(new Set())
    } finally {
      setScanning(false)
    }
  }

  async function handleBrowse(): Promise<void> {
    const folder = await window.api.browseGameInstallFolder()
    if (!folder) return
    setRoots((prev) => (prev.includes(folder) ? prev : [...prev, folder]))
  }

  async function handleAddSuggestedRoots(): Promise<void> {
    const suggested = await window.api.proposeInstallScanRoots()
    setRoots((prev) => {
      const next = [...prev]
      for (const root of suggested) {
        if (!next.includes(root)) next.push(root)
      }
      return next
    })
  }

  function toggleAppid(appid: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(appid)) next.delete(appid)
      else next.add(appid)
      return next
    })
  }

  async function handleAddSelected(): Promise<void> {
    const toAdd = candidates.filter((c) => selected.has(c.appid))
    if (toAdd.length === 0) return
    setImporting(true)
    setErrorMsg('')
    setStatusMsg('')
    setBatchErrors([])
    const errors: string[] = []
    const queue: PickerQueueItem[] = []
    try {
      for (const c of toAdd) {
        const name = c.guessedName
        try {
          await window.api.importScannedInstall({
            appid: c.appid,
            gameName: name,
            installPath: c.installPath,
            launchExe: c.suggestedExe || undefined
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`${name}: ${message}`)
          continue
        }
        setStatusMsg(`Fetching Hubcap for ${name}…`)
        try {
          const channel = `manifest:scan:${crypto.randomUUID()}`
          const zipPath = await window.api.depotDownloadManifest(c.appid, channel)
          const gameData = await window.api.depotProcessZip(zipPath)
          const buckets = bucketDepotsForScan(gameData.depots, gameData.manifests, gameData.dlcs)
          if (buckets.unsureIds.length === 0) {
            if (buckets.autoKeepIds.length === 0) {
              errors.push(`${name}: no Windows/DLC depots found`)
            } else {
              const gids = pickManifestGids(gameData.manifests, buckets.autoKeepIds)
              if (Object.keys(gids).length > 0) {
                await window.api.manifestSaveGids(c.appid, gids, name, c.installPath)
              } else {
                errors.push(`${name}: no Windows/DLC depots found`)
              }
            }
          } else {
            queue.push({
              appid: c.appid,
              gameName: name,
              installPath: c.installPath,
              gameData,
              autoKeepIds: buckets.autoKeepIds,
              unsureIds: buckets.unsureIds
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push(`${name}: ${message}`)
        }
      }
      setBatchErrors(errors)
      setPickerQueue(queue)
      setPickerIndex(0)
      if (queue.length === 0) {
        onImported()
        if (errors.length === 0) {
          setStatusMsg(
            `Added ${toAdd.length} game${toAdd.length === 1 ? '' : 's'} with manifest GIDs.`
          )
          onClose()
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = selected.size

  function finishPickerQueue(): void {
    setPickerQueue([])
    setPickerIndex(0)
    onImported()
    if (batchErrors.length === 0) {
      onClose()
    }
  }

  function advancePicker(): void {
    if (pickerIndex + 1 >= pickerQueue.length) {
      finishPickerQueue()
    } else {
      setPickerIndex((i) => i + 1)
    }
  }

  function togglePickerDepot(depotId: string): void {
    setPickerChecked((prev) => ({ ...prev, [depotId]: !prev[depotId] }))
  }

  async function handlePickerConfirm(): Promise<void> {
    if (!pickerItem) return
    const checkedIds = Object.keys(pickerChecked).filter((id) => pickerChecked[id])
    const gids = pickManifestGids(pickerItem.gameData.manifests, checkedIds)
    if (Object.keys(gids).length === 0) {
      setPickerError('Select at least one depot with a manifest GID.')
      return
    }
    setPickerSaving(true)
    setPickerError('')
    try {
      await window.api.manifestSaveGids(
        pickerItem.appid,
        gids,
        pickerItem.gameName,
        pickerItem.installPath
      )
      advancePicker()
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : String(err))
    } finally {
      setPickerSaving(false)
    }
  }

  function handlePickerSkip(): void {
    setPickerError('')
    advancePicker()
  }

  const pickerDepotIds = pickerItem
    ? [...new Set([...pickerItem.autoKeepIds, ...pickerItem.unsureIds])].sort()
    : []

  const combinedError = [
    ...batchErrors,
    ...(pickerActive ? (pickerError ? [pickerError] : []) : errorMsg ? [errorMsg] : [])
  ].join('\n')

  return (
    <div
      className="install-scan-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="install-scan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-scan-title"
      >
        <header className="install-scan-modal__header">
          <h2 id="install-scan-title" className="install-scan-modal__title">
            {pickerActive ? 'Select depots' : 'Scan for installed games'}
          </h2>
          <button
            type="button"
            className="install-scan-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {pickerActive && pickerItem ? (
          <>
            <p className="install-scan-modal__picker-subtitle">
              Game {pickerIndex + 1} of {pickerQueue.length}: {pickerItem.gameName}
            </p>

            <ul className="install-scan-modal__picker-list" aria-label="Depots to include">
              {pickerDepotIds.map((depotId) => {
                const depot = pickerItem.gameData.depots[depotId]
                const label = depot?.description ?? depotId
                return (
                  <li key={depotId} className="install-scan-modal__row">
                    <label className="install-scan-modal__row-label">
                      <input
                        type="checkbox"
                        checked={Boolean(pickerChecked[depotId])}
                        onChange={() => togglePickerDepot(depotId)}
                      />
                      <span className="install-scan-modal__row-main">
                        <span className="install-scan-modal__name">{label}</span>
                        <span className="install-scan-modal__meta">Depot {depotId}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="install-scan-modal__picker-toolbar">
              <Chip
                variant="action"
                onClick={() => void handlePickerConfirm()}
                disabled={pickerSaving}
              >
                {pickerSaving ? 'Saving…' : 'Confirm'}
              </Chip>
              <Chip onClick={handlePickerSkip} disabled={pickerSaving}>
                Skip
              </Chip>
            </div>
          </>
        ) : (
          <>
            <p className="install-scan-modal__lead">
              Looks for <code>steam_appid.txt</code> or numeric folders with{' '}
              <code>steam_api*.dll</code>. Does not download files or invent achievements.
            </p>

            <div className="install-scan-modal__roots">
              <div className="install-scan-modal__roots-head">
                <span>Scan roots</span>
                <div className="install-scan-modal__roots-actions">
                  <Chip onClick={() => void handleBrowse()}>Browse…</Chip>
                  <Chip onClick={() => void handleAddSuggestedRoots()}>Add suggested</Chip>
                </div>
              </div>
              {roots.length === 0 ? (
                <p className="install-scan-modal__empty">
                  No roots yet. Browse a folder or add suggested Games / Steam paths. Configure
                  permanently in Settings → Install scan folders.
                </p>
              ) : (
                <ul className="install-scan-modal__root-list">
                  {roots.map((root) => (
                    <li key={root}>
                      <span title={root}>{root}</span>
                      <button
                        type="button"
                        className="install-scan-modal__remove"
                        aria-label={`Remove ${root}`}
                        onClick={() => setRoots((prev) => prev.filter((r) => r !== root))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="install-scan-modal__check">
              <input
                type="checkbox"
                checked={includeIgnored}
                onChange={(e) => setIncludeIgnored(e.target.checked)}
              />
              Include ignored AppIDs
            </label>

            <div className="install-scan-modal__toolbar">
              <Chip
                variant="action"
                onClick={() => void handleScan()}
                disabled={scanning || roots.length === 0}
              >
                {scanning ? 'Scanning…' : 'Scan'}
              </Chip>
              <Chip
                variant="action"
                onClick={() => void handleAddSelected()}
                disabled={importing || selectedCount === 0}
              >
                {importing ? 'Adding…' : `Add selected (${selectedCount})`}
              </Chip>
            </div>

            {statusMsg && !combinedError && (
              <p className="install-scan-modal__status">{statusMsg}</p>
            )}

            <ul className="install-scan-modal__list" aria-label="Scan results">
              {candidates.map((c) => (
                <li key={c.appid} className="install-scan-modal__row">
                  <label className="install-scan-modal__row-label">
                    <input
                      type="checkbox"
                      checked={selected.has(c.appid)}
                      onChange={() => toggleAppid(c.appid)}
                    />
                    <span className="install-scan-modal__row-main">
                      <span className="install-scan-modal__name">{c.guessedName}</span>
                      <span className="install-scan-modal__meta">
                        AppID {c.appid}
                        {c.alreadyInLibrary ? ' · Already in library' : ''}
                        {c.ignored ? ' · Ignored' : ''}
                      </span>
                      <span className="install-scan-modal__path" title={c.installPath}>
                        {c.installPath}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {combinedError && <p className="install-scan-modal__error">{combinedError}</p>}
      </div>
    </div>
  )
}
