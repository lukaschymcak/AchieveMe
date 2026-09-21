import { ipcMain } from 'electron'
import { checkForUpdates, getUpdateState, installUpdate } from '../autoUpdateService'
import { getPendingChangelog } from '../changelogService'

export function registerUpdateHandlers(): void {
  ipcMain.handle('app:check-for-updates', async () => {
    return await checkForUpdates()
  })

  ipcMain.handle('app:get-update-state', () => {
    return getUpdateState()
  })

  ipcMain.handle('app:get-pending-changelog', () => {
    return getPendingChangelog()
  })

  ipcMain.handle('app:install-update', () => {
    installUpdate()
  })
}
