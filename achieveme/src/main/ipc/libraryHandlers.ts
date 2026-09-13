import { ipcMain, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/database'
import {
  getAllGames,
  getGame,
  getAchievementsForGame,
  getAllGameAppids,
  getIgnoredAppids,
  getSaveLocationsForApp,
  deleteGame,
  ignoreAppid,
  deleteCacheEntry
} from '../db/repository'
import { getStoreCoverUrl } from '../achievement/steamApiClient'
import { getGameHunterStats, startWarmHunterLibrary } from '../achievement/gameHunterStatsService'
import { cacheCoverUrl, cacheHeroUrl } from '../../shared/imageCacheUrls'
import { hasStoredManifestGids } from '../../shared/libraryRetentionUtils'
import { normalizeProfileStats, regenerateProfileStats } from '../achievement/profileStatsService'
import { processAppId } from '../achievement/processAppId'
import { scanAllSources } from '../achievement/discoveryService'
import { pruneOrphanedGames } from '../achievement/watcherService'
import { pruneAppImages, getImagesCacheRoot } from '../achievement/imageCacheProtocol'
import { coverFilePath } from '../achievement/imageCacheService'
import { notifyLibraryUpdated } from '../achievement/libraryNotifyService'
import { runStartupUpdateCheck } from '../achievement/manifestCheckerService'
import type { ProfileStats, GameSummary, GameDetail, GameHunterStats } from '../../shared/types'
import { loadSettings } from '../settings'

export function registerLibraryHandlers(): void {
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
    const cacheRoot = getImagesCacheRoot()
    const summaries: GameSummary[] = []
    for (const g of games) {
      const dest = coverFilePath(cacheRoot, g.appid)
      let coverUrl = ''
      if (fs.existsSync(dest)) {
        coverUrl = cacheCoverUrl(g.appid)
      } else {
        const remoteCover = await getStoreCoverUrl(db, g.appid)
        coverUrl = remoteCover ? cacheCoverUrl(g.appid) : ''
      }
      summaries.push({
        appid: g.appid,
        name: g.name,
        cover_url: coverUrl,
        total_achievements: g.total_achievements,
        unlocked_achievements: g.unlocked_achievements,
        completion_pct: g.completion_pct,
        has_platinum: g.has_platinum === 1,
        last_unlocked_at: g.last_unlocked_at,
        playtime_seconds: g.playtime_seconds ?? 0,
        install_path: g.install_path ?? '',
        launch_exe: g.launch_exe ?? '',
        update_status: g.update_status ?? '',
        backup_status: g.backup_status ?? '',
        backup_at: g.backup_at ?? 0,
        backup_error: g.backup_error ?? '',
        ludusavi_title: g.ludusavi_title ?? '',
        cloud_saves_enabled: g.cloud_saves_enabled ? 1 : 0,
        has_depot_gids: hasStoredManifestGids(g.manifest_gids)
      })
    }
    return summaries
  })

  ipcMain.handle('get-game-detail', async (_event, appid: string): Promise<GameDetail | null> => {
    const db = getDb()
    const game = getGame(db, appid)
    if (!game) return null
    const achievements = getAchievementsForGame(db, appid)
    const remoteCover = await getStoreCoverUrl(db, appid)
    return {
      game,
      achievements,
      cover_url: remoteCover ? cacheCoverUrl(appid) : '',
      backdrop_url: cacheHeroUrl(appid)
    }
  })

  ipcMain.handle(
    'get-game-hunter-stats',
    async (
      _event,
      appid: string,
      options?: { forceRefresh?: boolean }
    ): Promise<GameHunterStats> => {
      try {
        return await getGameHunterStats(getDb(), String(appid ?? ''), undefined, {
          forceRefresh: Boolean(options?.forceRefresh)
        })
      } catch {
        return {
          reviewPercent: null,
          reviewCount: null,
          metacritic: null,
          reviewSummary: null,
          hasAny: false
        }
      }
    }
  )

  ipcMain.handle('hunter:warm-library', async () => {
    const db = getDb()
    const result = await startWarmHunterLibrary(db, getAllGameAppids(db))
    if (result.warmed > 0) notifyLibraryUpdated()
    return result
  })

  ipcMain.handle('refresh-game', async (_event, appid: string): Promise<void> => {
    const settings = loadSettings()
    await processAppId(appid, settings, true, true)
    await getGameHunterStats(getDb(), String(appid ?? ''), undefined, {
      forceRefresh: true
    }).catch(() => undefined)
  })

  ipcMain.handle('refresh', async (): Promise<void> => {
    const settings = loadSettings()
    const db = getDb()
    const ignored = new Set(getIgnoredAppids(db))

    pruneOrphanedGames(settings)

    const discovered = scanAllSources(settings)
    const appids = [...new Set(discovered.map((d) => d.appid))].filter((id) => !ignored.has(id))
    for (const appid of appids) {
      await processAppId(appid, settings, true, true)
      await getGameHunterStats(db, appid, undefined, { forceRefresh: true }).catch(() => undefined)
    }

    const dbGames = getAllGames(db)
    for (const game of dbGames) {
      if (!appids.includes(game.appid) && !ignored.has(game.appid)) {
        await processAppId(game.appid, settings, true, true)
        await getGameHunterStats(db, game.appid, undefined, { forceRefresh: true }).catch(
          () => undefined
        )
      }
    }

    // Fire-and-forget — leave existing update_status alone on failure
    void runStartupUpdateCheck(db).catch(() => undefined)
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
    ignoreAppid(db, appid)
    pruneAppImages(appid)
    deleteCacheEntry(db, '__steam_news__', `news:${appid}`)
    regenerateProfileStats(db)
    notifyLibraryUpdated(appid)
  })
}
