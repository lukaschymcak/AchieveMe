import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getDb } from '../db/database'
import { getAllGames, getGame, getAchievementsForGame, upsertAchievements } from '../db/repository'
import { getStoreCoverUrl } from '../achievement/steamApiClient'
import { ensureSteamDbHiddenDescriptions } from '../achievement/steamDbScraper'
import { loadSettings, saveSettings } from '../settings'
import { startWatcher } from '../achievement/watcherService'
import { scanAllSources } from '../achievement/discoveryService'
import { processAppId } from '../achievement/processAppId'
import { buildExportBundle } from '../achievement/exportService'
import { importBundle } from '../achievement/importService'
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

    for (const g of games) {
      const achievements = getAchievementsForGame(db, g.appid)
      const updated = await ensureSteamDbHiddenDescriptions(db, g.appid, achievements)
      if (updated) upsertAchievements(db, achievements)
    }

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
        has_platinum: g.has_platinum === 1
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

  ipcMain.handle('export-json', async (): Promise<void> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export AchieveMe data',
      defaultPath: 'achieveme-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return

    const db = getDb()
    const settings = loadSettings()
    const data = buildExportBundle(db, settings)

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  })

  ipcMain.handle('import-json', async (): Promise<ImportResult | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import AchieveMe data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const text = fs.readFileSync(filePaths[0], 'utf8')
    const bundle = JSON.parse(text)
    if (!bundle?.games || !bundle?.achievements) {
      throw new Error('Invalid export file: missing games or achievements')
    }

    const db = getDb()
    const settings = loadSettings()
    return importBundle(db, bundle, settings)
  })
}
