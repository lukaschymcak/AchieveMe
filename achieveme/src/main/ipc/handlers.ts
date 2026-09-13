import { app } from 'electron'
import { loadSettings } from '../settings'
import { setAchieveMeLudusaviConfigDir } from '../achievement/ludusaviService'
import { refreshAchieveMeLudusaviConfigFromGui } from '../achievement/ludusaviService'
import { getAchieveMeLudusaviConfigDir } from '../../shared/ludusaviCloudUtils'
import { initBackupQueue, registerBackupHandlers } from './backupHandlers'
import { registerDepotHandlers } from './depotHandlers'
import { registerGameLaunchHandlers } from './gameLaunchHandlers'
import { registerLibraryHandlers } from './libraryHandlers'
import { registerMiscHandlers } from './miscHandlers'
import { registerSettingsHandlers } from './settingsHandlers'

export function registerIpcHandlers(): void {
  // One-time startup wiring for Ludusavi isolated config directory.
  setAchieveMeLudusaviConfigDir(getAchieveMeLudusaviConfigDir(app.getPath('userData')))
  try {
    refreshAchieveMeLudusaviConfigFromGui(loadSettings().rclonePath)
  } catch {
    // GUI config may be missing on first run
  }

  // Initialise the Ludusavi backup queue with its service dependencies.
  initBackupQueue()

  // Register all IPC handler domains.
  registerLibraryHandlers()
  registerSettingsHandlers()
  registerGameLaunchHandlers()
  registerBackupHandlers()
  registerDepotHandlers()
  registerMiscHandlers()
}
