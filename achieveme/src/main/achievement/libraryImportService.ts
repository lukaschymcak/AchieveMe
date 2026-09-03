import fs from 'node:fs'
import type Database from 'better-sqlite3'
import { validateImportExistingInstall } from '../../shared/libraryImportUtils'
import { saveManifestGids } from '../db/repository'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { scheduleGameBackup } from './ludusaviBackupQueue'

export { validateImportExistingInstall }

/**
 * Registers an on-disk DepotDownloader install in the library without downloading.
 * Writes manifest GIDs + install_path and clears any ignore entry.
 *
 * @param db - Open SQLite database.
 * @param input - AppID, display name, folder, and depot → GID map.
 */
export function importExistingInstall(
  db: Database.Database,
  input: {
    appid: string
    gameName: string
    installPath: string
    gids: Record<string, string>
  }
): void {
  const appid = String(input.appid || '').trim()
  const installPath = String(input.installPath || '').trim()
  const gids = input.gids || {}

  let pathExists = false
  let isDirectory = false
  try {
    pathExists = fs.existsSync(installPath)
    isDirectory = pathExists && fs.statSync(installPath).isDirectory()
  } catch {
    pathExists = false
    isDirectory = false
  }

  const error = validateImportExistingInstall({
    appid,
    installPath,
    gids,
    pathExists,
    isDirectory
  })
  if (error) throw new Error(error)

  const gameName = String(input.gameName || '').trim() || `App ${appid}`
  // saveManifestGids also un-ignores the AppID.
  saveManifestGids(db, appid, gids, gameName, installPath)
  notifyLibraryUpdated(appid)
  scheduleGameBackup(appid, 'add')
}
