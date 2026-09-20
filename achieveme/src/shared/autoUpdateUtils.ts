import type { AppUpdateState } from './types'

/**
 * Returns a human-friendly label describing the current auto-update state.
 */
export function formatUpdateStatusLabel(state: AppUpdateState | null | undefined): string {
  if (!state) return 'Unknown'
  switch (state.status) {
    case 'checking':
      return 'Checking for updates...'
    case 'available':
      return state.newVersion ? `New update available: v${state.newVersion}` : 'Update available'
    case 'downloading': {
      const pct = state.progressPercent ?? 0
      return `Downloading update... ${pct}%`
    }
    case 'downloaded':
      return state.newVersion ? `Version v${state.newVersion} ready to install` : 'Update ready to install'
    case 'not-available':
      return state.devMode ? 'Up to date (Dev mode)' : 'AchieveMe is up to date'
    case 'error':
      return state.error ? `Update check failed: ${state.error}` : 'Update check failed'
    case 'idle':
    default:
      return 'Up to date'
  }
}

/**
 * True if the user can initiate a manual update check.
 */
export function canCheckForUpdates(state: AppUpdateState | null | undefined): boolean {
  if (!state) return true
  return state.status !== 'checking' && state.status !== 'downloading'
}

/**
 * True if an update binary has been verified and downloaded, ready for restart.
 */
export function canInstallUpdate(state: AppUpdateState | null | undefined): boolean {
  if (!state) return false
  return state.status === 'downloaded'
}

/**
 * True if an update is actively downloading chunks in the background.
 */
export function isUpdateDownloading(state: AppUpdateState | null | undefined): boolean {
  if (!state) return false
  return state.status === 'downloading'
}

/**
 * Formats byte counts into human-readable strings (e.g. 15.4 MB).
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let val = bytes
  let idx = 0
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024
    idx++
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}
