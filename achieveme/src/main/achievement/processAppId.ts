import { getDb } from '../db/database'
import { upsertGame, upsertAchievements } from '../db/repository'
import { scanAllSources } from './discoveryService'
import { parseAchievementsBySource } from './parsers/parseBySource'
import { mergeRawAchievements } from './rawMerge'
import { enrichApp } from './steamApiClient'
import { regenerateProfileStats } from './profileStatsService'
import type { AppSettings } from '../../shared/types'

export async function processAppId(
  appid: string,
  settings: AppSettings,
  forceRefresh = false
): Promise<void> {
  const db = getDb()

  // 1. Find all save files on disk for this appid
  const allDiscovered = scanAllSources(settings)
  const forThisApp = allDiscovered.filter((d) => d.appid === appid)
  if (forThisApp.length === 0) return

  // 2. Parse each save file
  const parsedRows = forThisApp.map((d) => ({
    source: d.source,
    raw: parseAchievementsBySource(d.source, d.filePath)
  }))

  // 3. Merge across sources
  const mergedRaw = mergeRawAchievements(parsedRows)

  // 4. Enrich with Steam API data (schema, global %, app name)
  const enriched = await enrichApp(appid, settings.steamApiKey, mergedRaw, db, forceRefresh)

  // 5. Write to SQLite
  upsertGame(db, enriched.game)
  upsertAchievements(db, enriched.achievements)

  // 6. Rebuild profile_stats.json
  regenerateProfileStats(db)
}
