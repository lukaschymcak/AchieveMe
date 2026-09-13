import { ipcMain, dialog } from 'electron'
import path from 'node:path'
import { loadSettings, saveSettings, normalizeSettings } from '../settings'
import { detectAppRuntime, loginItemsSupported, syncLoginItemSettings } from '../loginItemService'
import { startPlaytimeTracker, stopPlaytimeTracker } from '../achievement/playtimeService'
import { startWatcher } from '../achievement/watcherService'
import { validateSteamlessFolder } from '../achievement/steamlessService'
import { validateLudusaviPath } from '../achievement/ludusaviService'
import { previewUnlockToast } from '../achievement/unlockNotifyService'
import { acknowledgeSessionRecap, previewSessionRecap } from '../achievement/sessionRecapService'
import { openPath } from './handlerUtils'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', (): AppSettings => loadSettings())

  ipcMain.handle(
    'get-app-runtime',
    (): { isPackaged: boolean; isPortable: boolean; loginItemsSupported: boolean } => {
      const runtime = detectAppRuntime()
      return { ...runtime, loginItemsSupported: loginItemsSupported(runtime) }
    }
  )

  ipcMain.handle('save-settings', async (_event, settings: AppSettings): Promise<void> => {
    const normalized = normalizeSettings(settings)
    normalized.steamlessFolder = normalized.steamlessFolder.trim()
      ? validateSteamlessFolder(normalized.steamlessFolder)
      : ''
    if (normalized.ludusaviPath.trim()) {
      try {
        normalized.ludusaviPath = validateLudusaviPath(normalized.ludusaviPath)
      } catch {
        normalized.ludusaviPath = ''
      }
    } else {
      normalized.ludusaviPath = ''
    }
    // Legacy rclone field kept for settings.json compatibility but otherwise ignored.
    normalized.rclonePath = String(normalized.rclonePath || '')
    saveSettings(normalized)
    syncLoginItemSettings(normalized)
    if (normalized.playtimeTrackingEnabled) {
      startPlaytimeTracker()
    } else {
      stopPlaytimeTracker()
    }
    await startWatcher(normalized)
  })

  ipcMain.handle('browse-sound-path', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select unlock sound',
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('browse-steamless-folder', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Steamless folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return validateSteamlessFolder(filePaths[0])
  })

  ipcMain.handle('browse-ludusavi-path', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select ludusavi.exe',
      filters: [{ name: 'Ludusavi', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return validateLudusaviPath(filePaths[0])
  })

  ipcMain.handle('browse-game-install-folder', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select game install folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return path.resolve(filePaths[0])
  })

  ipcMain.handle(
    'open-path',
    (_event, targetPath: string | string[]): Promise<void> => openPath(targetPath)
  )

  ipcMain.handle('preview-unlock-toast', (): void => previewUnlockToast())
  ipcMain.handle('preview-session-recap', (): void => previewSessionRecap())
  ipcMain.on('session-recap-done', () => acknowledgeSessionRecap())
}
