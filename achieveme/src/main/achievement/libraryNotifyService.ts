import { BrowserWindow } from 'electron'
import type { LibraryUpdatedPayload } from '../../shared/types'
import { buildLibraryUpdatedPayload } from './libraryNotifyUtils'

const DEBOUNCE_MS = 100

let pendingAppids: Array<string | null> = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function broadcastLibraryUpdated(payload: LibraryUpdatedPayload): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send('library-updated', payload)
  }
}

function flushLibraryUpdated(): void {
  flushTimer = null
  const payload = buildLibraryUpdatedPayload(pendingAppids)
  pendingAppids = []
  broadcastLibraryUpdated(payload)
}

export function notifyLibraryUpdated(appid?: string): void {
  pendingAppids.push(appid ?? null)

  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flushLibraryUpdated, DEBOUNCE_MS)
}

/** Test helper — flush pending notifications immediately. */
export function flushLibraryUpdatedNotificationsForTest(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pendingAppids.length > 0) {
    flushLibraryUpdated()
  }
}
