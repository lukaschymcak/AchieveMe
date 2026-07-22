import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import https from 'node:https'
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
import { getSteamLibraryHeroUrl } from '../../shared/steamUrls'
import { loadSettings, saveSettings, normalizeSettings } from '../settings'
import { startPlaytimeTracker, stopPlaytimeTracker } from '../achievement/playtimeService'
import { startWatcher, pruneOrphanedGames } from '../achievement/watcherService'
import { scanAllSources } from '../achievement/discoveryService'
import { processAppId } from '../achievement/processAppId'
import { buildFullBackupZip } from '../achievement/exportZipService'
import { importFullBackupZip } from '../achievement/importZipService'
import { normalizeProfileStats, regenerateProfileStats } from '../achievement/profileStatsService'
import { applyGoldberg } from '../achievement/goldbergSetupService'
import { previewUnlockToast } from '../achievement/unlockNotifyService'
import { updateGameInstallPath } from '../db/repository'
import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult, SteamSearchResult, GoldbergApplyRequest, SteamApiDllInfo } from '../../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('get-profile-stats', (): ProfileStats | null => {
    const statsPath = path.join(app.getPath('userData'), 'profile_stats.json')
    try {
      const text = fs.readFileSync(statsPath, 'utf8')
      return normalizeProfileStats(JSON.parse(text) as ProfileStats)
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
        last_unlocked_at: g.last_unlocked_at,
        playtime_seconds: g.playtime_seconds ?? 0
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
    const backdrop_url = getSteamLibraryHeroUrl(appid)
    return { game, achievements, cover_url, backdrop_url }
  })

  ipcMain.handle('get-settings', (): AppSettings => {
    return loadSettings()
  })

  ipcMain.handle('save-settings', async (_event, settings: AppSettings): Promise<void> => {
    const normalized = normalizeSettings(settings)
    saveSettings(normalized)
    if (normalized.playtimeTrackingEnabled) {
      startPlaytimeTracker()
    } else {
      stopPlaytimeTracker()
    }
    await startWatcher(normalized)
  })

  ipcMain.handle('refresh-game', async (_event, appid: string): Promise<void> => {
    const settings = loadSettings()
    await processAppId(appid, settings, true, true)
  })

  ipcMain.handle('refresh', async (): Promise<void> => {
    const settings = loadSettings()
    const db = getDb()

    pruneOrphanedGames(settings)

    const discovered = scanAllSources(settings)
    const appids = [...new Set(discovered.map((d) => d.appid))]
    for (const appid of appids) {
      await processAppId(appid, settings, true, true)
    }
    const dbGames = getAllGames(db)
    for (const game of dbGames) {
      if (!appids.includes(game.appid)) {
        await processAppId(game.appid, settings, true, true)
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

  ipcMain.handle('browse-sound-path', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select unlock sound',
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('preview-unlock-toast', (): void => {
    previewUnlockToast()
  })

  ipcMain.handle('search-steam-games', (_event, query: string): Promise<SteamSearchResult[]> => {
    return new Promise((resolve) => {
      const term = encodeURIComponent(query.trim())
      if (!term) {
        resolve([])
        return
      }
      const url = `https://store.steampowered.com/api/storesearch/?term=${term}&l=english&cc=US`
      https
        .get(url, { headers: { 'User-Agent': 'AchieveMe/1.0' } }, (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })
          res.on('end', () => {
            try {
              const json = JSON.parse(data) as {
                items?: Array<{
                  id?: number | string
                  name?: string
                  tiny_image?: string
                }>
              }
              const results: SteamSearchResult[] = (json.items ?? [])
                .filter((item) => item.id !== undefined)
                .map((item) => ({
                  appid: String(item.id),
                  name: item.name ?? `App ${item.id}`,
                  imageUrl: item.tiny_image ?? null
                }))
              resolve(results)
            } catch {
              resolve([])
            }
          })
        })
        .on('error', () => resolve([]))
    })
  })

  ipcMain.handle('browse-dll-path', async (): Promise<SteamApiDllInfo | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select steam_api.dll or steam_api64.dll',
      filters: [{ name: 'Steam API DLL', extensions: ['dll'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const dllPath = path.resolve(filePaths[0])
    const fileName = path.basename(dllPath)
    const lower = fileName.toLowerCase()
    if (lower !== 'steam_api.dll' && lower !== 'steam_api64.dll') {
      throw new Error('Select steam_api.dll or steam_api64.dll.')
    }
    if (!fs.existsSync(dllPath)) {
      throw new Error('Steam API DLL was not found.')
    }

    return {
      path: dllPath,
      fileName,
      directory: path.dirname(dllPath),
      architecture: lower === 'steam_api64.dll' ? 'x64' : 'x86'
    }
  })

  ipcMain.handle('apply-goldberg', async (event, request: GoldbergApplyRequest): Promise<void> => {
    const settings = loadSettings()
    await applyGoldberg(request, settings, (line) => {
      event.sender.send('goldberg-log', line)
    })
  })
}
