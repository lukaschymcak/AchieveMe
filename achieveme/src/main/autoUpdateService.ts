import { app, type BrowserWindow } from 'electron'
import electronUpdater, { type UpdateInfo, type ProgressInfo, type AppUpdater } from 'electron-updater'
import type { AppUpdateState } from '../shared/types'
import { savePendingChangelog } from './changelogService'

function getAutoUpdater(): AppUpdater {
  const mod = (electronUpdater as unknown as { default?: typeof electronUpdater }).default ?? electronUpdater
  return mod.autoUpdater
}

let updateMainWindow: BrowserWindow | null = null
let isInitialized = false

let currentState: AppUpdateState = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function broadcastState(patch: Partial<AppUpdateState>): void {
  currentState = { ...currentState, ...patch }
  if (updateMainWindow && !updateMainWindow.isDestroyed()) {
    updateMainWindow.webContents.send('app:update-state', currentState)
  }
}

/**
 * Configure electron-updater event listeners and assign main window.
 */
export function initAutoUpdater(window: BrowserWindow): void {
  updateMainWindow = window
  currentState.currentVersion = app.getVersion()

  if (isInitialized) return
  isInitialized = true

  const updater = getAutoUpdater()

  // Automatic background downloads once an update is discovered.
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = false

  updater.on('checking-for-update', () => {
    broadcastState({
      status: 'checking',
      error: undefined
    })
  })

  updater.on('update-available', (info: UpdateInfo) => {
    broadcastState({
      status: 'available',
      newVersion: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      error: undefined
    })
  })

  updater.on('update-not-available', () => {
    broadcastState({
      status: 'not-available',
      checkedAt: Date.now(),
      error: undefined
    })
  })

  updater.on('download-progress', (progress: ProgressInfo) => {
    broadcastState({
      status: 'downloading',
      progressPercent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferredBytes: progress.transferred,
      totalBytes: progress.total
    })
  })

  updater.on('update-downloaded', (info: UpdateInfo) => {
    const rawNotes = Array.isArray(info.releaseNotes)
      ? info.releaseNotes
          .map((r) => (typeof r === 'string' ? r : r?.note))
          .filter(Boolean)
          .join('\n')
      : typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : ''

    const trimmedNotes = rawNotes.trim()
    if (trimmedNotes) {
      savePendingChangelog({
        version: info.version,
        notes: trimmedNotes,
        releaseDate: info.releaseDate
      })
    }

    broadcastState({
      status: 'downloaded',
      newVersion: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: trimmedNotes || undefined,
      progressPercent: 100,
      checkedAt: Date.now(),
      error: undefined
    })
  })

  updater.on('error', (err: Error) => {
    broadcastState({
      status: 'error',
      error: err?.message || 'Failed to check for updates',
      checkedAt: Date.now()
    })
  })

  // In packaged builds, check for updates after a short launch delay
  if (app.isPackaged) {
    setTimeout(() => {
      void checkForUpdates().catch(() => undefined)
    }, 10_000)
  }
}

/**
 * Triggers an update check against GitHub Releases.
 * In development / unpackaged mode, safely reports not-available without throwing.
 */
export async function checkForUpdates(): Promise<AppUpdateState> {
  currentState.currentVersion = app.getVersion()

  if (!app.isPackaged) {
    broadcastState({
      status: 'not-available',
      devMode: true,
      checkedAt: Date.now(),
      error: undefined
    })
    return currentState
  }

  broadcastState({
    status: 'checking',
    error: undefined
  })

  try {
    const updater = getAutoUpdater()
    await updater.checkForUpdates()
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    broadcastState({
      status: 'error',
      error: errorMsg,
      checkedAt: Date.now()
    })
  }

  return currentState
}

/**
 * Returns current update state.
 */
export function getUpdateState(): AppUpdateState {
  currentState.currentVersion = app.getVersion()
  return currentState
}

/**
 * Quits the application and runs the downloaded NSIS installer.
 */
export function installUpdate(): void {
  if (currentState.status === 'downloaded') {
    // isSilent = true (no installer window), isForceRunAfter = true (reopen app after update)
    const updater = getAutoUpdater()
    updater.quitAndInstall(true, true)
  }
}
