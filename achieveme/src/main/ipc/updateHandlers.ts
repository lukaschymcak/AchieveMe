import { ipcMain, app } from 'electron'
import { checkForUpdates, getUpdateState, installUpdate } from '../autoUpdateService'
import { getPendingChangelog, fetchChangelogFromGitHub } from '../changelogService'

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

  ipcMain.handle('app:get-latest-changelog', async () => {
    return getPendingChangelog() || (await fetchChangelogFromGitHub(app.getVersion()))
  })

  ipcMain.handle('app:install-update', () => {
    installUpdate()
  })
}
