import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getDb } from '../db/database'
import {
  getAllGames,
  getGame,
  getAchievementsForGame,
  getSaveLocationsForApp,
  deleteGame
} from '../db/repository'
import { getStoreCoverUrl } from '../achievement/steamApiClient'
import { loadSettings, saveSettings } from '../settings'
import { startWatcher, pruneOrphanedGames } from '../achievement/watcherService'
import { scanAllSources } from '../achievement/discoveryService'
import { processAppId } from '../achievement/processAppId'
import { buildFullBackupZip } from '../achievement/exportZipService'
import { importFullBackupZip } from '../achievement/importZipService'
import { regenerateProfileStats } from '../achievement/profileStatsService'
import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult } from '../../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('get-profile-stats', (): ProfileStats | null => {
    const statsPath = path.join(app.getPath('userData'), 'profile_stats.json')
    try {
      const text = fs.readFileSync(statsPath, 'utf8')
      return JSON.parse(text) as ProfileStats
    } catch {
      return null
    }
  })

  ipcMain.handle('get-all-games', async (): Promise<GameSummary[]> => {
    const db = getDb()
    const games = getAllGames(db)

    const summaries: GameSummary[] = []
    for (const g of games) {
      const cover_url = await getStoreCoverUrl(db, g.appid)
      summaries.push({
        appid: g.appid,
        name: g.name,
        cover_url,
        total_achievements: g.total_achievements,
        unlocked_achievements: g.unlocked_achievements,
        completion_pct: g.completion_pct,
        has_platinum: g.has_platinum === 1,
        last_unlocked_at: g.last_unlocked_at
      })
    }
    return summaries
  })

  ipcMain.handle('get-game-detail', async (_event, appid: string): Promise<GameDetail | null> => {
    const db = getDb()
    const game = getGame(db, appid)
    if (!game) return null
    const achievements = getAchievementsForGame(db, appid)
    const cover_url = await getStoreCoverUrl(db, appid)
    return { game, achievements, cover_url }
  })

  ipcMain.handle('get-settings', (): AppSettings => {
    return loadSettings()
  })

  ipcMain.handle('save-settings', async (_event, settings: AppSettings): Promise<void> => {
    saveSettings(settings)
    await startWatcher(settings)
  })

  ipcMain.handle('refresh', async (): Promise<void> => {
    const settings = loadSettings()
    const db = getDb()

    pruneOrphanedGames(settings)

    const discovered = scanAllSources(settings)
    const appids = [...new Set(discovered.map((d) => d.appid))]
    for (const appid of appids) {
      await processAppId(appid, settings, true)
    }
    const dbGames = getAllGames(db)
    for (const game of dbGames) {
      if (!appids.includes(game.appid)) {
        await processAppId(game.appid, settings, true)
      }
    }
  })

  ipcMain.handle('delete-game', async (_event, appid: string): Promise<void> => {
    const db = getDb()
    const locations = getSaveLocationsForApp(db, appid)
    const deletedFolders = new Set<string>()

    for (const loc of locations) {
      const folder = path.dirname(loc.file_path)
      const folderKey = folder.toLowerCase()
      if (deletedFolders.has(folderKey)) continue
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true })
        deletedFolders.add(folderKey)
      }
    }

    deleteGame(db, appid)
    regenerateProfileStats(db)
  })

  ipcMain.handle('export-zip', async (): Promise<void> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Backup',
      defaultPath: 'achieveme-backup.zip',
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return

    const db = getDb()
    const settings = loadSettings()
    buildFullBackupZip(db, settings, filePath)
  })

  ipcMain.handle('import-zip', async (): Promise<ImportResult | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Backup',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const db = getDb()
    const settings = loadSettings()
    return importFullBackupZip(db, filePaths[0], settings)
  })
}
