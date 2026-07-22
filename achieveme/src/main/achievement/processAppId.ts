import { getDb } from '../db/database'
import {
  upsertGame,
  upsertAchievements,
  upsertSaveLocation,
  deleteSaveLocationsForApp,
  deleteGame,
  getAchievementsForGame,
  getGame
} from '../db/repository'
import { scanAllSources } from './discoveryService'
import { parseAchievementsBySource } from './parsers/parseBySource'
import { mergeRawAchievements } from './rawMerge'
import { enrichApp } from './steamApiClient'
import { regenerateProfileStats } from './profileStatsService'
import { encodePortablePath, GOLDBERG_JSON_SOURCES } from './savePathUtils'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { diffAchievements } from './achievementDiff'
import { notifyPlatinumUnlock, notifyUnlocks } from './unlockNotifyService'
import { isNewPlatinum } from '../../shared/unlockToastUtils'
import type { AppSettings } from '../../shared/types'

export async function processAppId(
  appid: string,
  settings: AppSettings,
  forceRefresh = false,
  suppressNotifications = false
): Promise<void> {
  const db = getDb()
  const previousAchievements = getAchievementsForGame(db, appid)
  const previousGame = getGame(db, appid)
  const hadPriorRows = previousAchievements.length > 0

  // 1. Find all save files on disk for this appid
  const allDiscovered = scanAllSources(settings)
  const forThisApp = allDiscovered.filter((d) => d.appid === appid)
  if (forThisApp.length === 0) {
    deleteGame(db, appid)
    regenerateProfileStats(db)
    notifyLibraryUpdated(appid)
    return
  }

  deleteSaveLocationsForApp(db, appid)

  const now = Math.floor(Date.now() / 1000)
  for (const d of forThisApp) {
    if (!GOLDBERG_JSON_SOURCES.includes(d.source)) continue
    const hint = encodePortablePath(d.filePath, d.source, settings)
    upsertSaveLocation(db, {
      appid: d.appid,
      source: d.source,
      file_path: d.filePath,
      root_kind: hint.rootKind,
      root_source: hint.rootSource,
      custom_root: hint.customRoot,
      relative_path: hint.relativePath,
      updated_at: now
    })
  }

  // 2. Parse each save file
  const parsedRows = forThisApp.map((d) => ({
    source: d.source,
    raw: parseAchievementsBySource(d.source, d.filePath)
  }))

  // 3. Merge across sources
  const mergedRaw = mergeRawAchievements(parsedRows)

  // 4. Enrich with Steam API data (schema, global %, app name)
  const enriched = await enrichApp(appid, settings.steamApiKey, mergedRaw, db, forceRefresh)

  const diff = diffAchievements(previousAchievements, enriched.achievements)
  const newlyPlatinum = isNewPlatinum(
    hadPriorRows,
    previousGame?.has_platinum ?? 0,
    enriched.game.has_platinum
  )

  // 5. Write to SQLite
  upsertGame(db, enriched.game)
  upsertAchievements(db, enriched.achievements)

  // 6. Rebuild profile_stats.json
  regenerateProfileStats(db)

  if (!suppressNotifications && hadPriorRows) {
    if (diff.unlocked.length > 0) {
      notifyUnlocks(appid, enriched.game.name, diff.unlocked)
    }
    if (newlyPlatinum) {
      notifyPlatinumUnlock(appid, enriched.game.name, diff.unlocked.length === 0)
    }
  }

  notifyLibraryUpdated(appid)
}
