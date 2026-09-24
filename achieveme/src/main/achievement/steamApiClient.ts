import https from 'node:https'
import type { Achievement, Game, RawAchievement } from '../../shared/types'
import {
  buildAchievementRecords,
  resolveAchievementSchema,
  schemaListFromSteamResponse,
  achievementPercentagesFromRecords,
  type SteamSchemaAchievement
} from '../../shared/achievementSchemaUtils.ts'
import { normalizeSteamIconUrl } from '../../shared/steamUrls.ts'
import { pickSteamAppDetailsEntry } from '../../shared/steamAppDetailsUtils.ts'
import {
  getCacheEntry,
  setCacheEntry,
  getGame,
  getAchievementsForGame
} from '../db/repository.ts'
import { isFresh } from './cacheUtils.ts'
import { ensureSteamDbHiddenDescriptions } from './steamDbScraper.ts'
import { readSteamSettingsSchema } from './steamSettingsSchemaReader.ts'
import type Database from 'better-sqlite3'

export type { SteamSchemaAchievement }
export { buildAchievementRecords, resolveAchievementSchema, achievementPercentagesFromRecords }

const SCHEMA_TTL = 604800
const APPDETAILS_TTL = 604800

function httpGet(url: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err: Error | null, result?: string): void => {
      if (settled) return
      settled = true
      if (err) {
        reject(err)
      } else {
        resolve(result ?? '')
      }
    }

    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        finish(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')))
      res.on('error', (err) => finish(err))
    })

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout (${timeoutMs}ms) for ${url}`))
    })
    req.on('error', (err) => finish(err))
  })
}

function readCache(db: Database.Database, appid: string, type: string, ttl: number): unknown | null {
  const row = getCacheEntry(db, appid, type)
  if (!row || !isFresh(row.cached_at, ttl)) return null
  try {
    return JSON.parse(row.data_json)
  } catch {
    return null
  }
}

function writeCache(db: Database.Database, appid: string, type: string, data: unknown): void {
  setCacheEntry(db, appid, type, JSON.stringify(data))
}

interface SteamSchemaResponse {
  game?: {
    availableGameStats?: {
      achievements?: SteamSchemaAchievement[]
    }
  }
}

/**
 * Reads a schema cache row ignoring TTL. Returns null when missing or invalid.
 * An empty array is a valid cached schema (game has no achievements).
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 */
export function readAnySchemaCache(
  db: Database.Database,
  appid: string
): SteamSchemaAchievement[] | null {
  const row = getCacheEntry(db, appid, 'schema')
  if (!row) return null
  try {
    const parsed = JSON.parse(row.data_json) as unknown
    return Array.isArray(parsed) ? (parsed as SteamSchemaAchievement[]) : null
  } catch {
    return null
  }
}

export async function fetchSchema(
  db: Database.Database,
  appid: string,
  apiKey: string,
  forceRefresh: boolean
): Promise<SteamSchemaAchievement[] | null> {
  const freshCache = !forceRefresh
    ? (readCache(db, appid, 'schema', SCHEMA_TTL) as SteamSchemaAchievement[] | null)
    : null
  const staleCache = readAnySchemaCache(db, appid)

  if (!forceRefresh && freshCache !== null) {
    return resolveAchievementSchema({
      forceRefresh,
      freshCache,
      live: undefined,
      staleCache
    })
  }

  let live: SteamSchemaAchievement[] | null | undefined = undefined

  if (apiKey) {
    live = null
    try {
      const url =
        `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
        `?key=${apiKey}&appid=${appid}&format=json`
      const body = await httpGet(url)
      const parsed = JSON.parse(body) as SteamSchemaResponse
      const liveResult = schemaListFromSteamResponse(parsed)
      if (liveResult !== null) {
        writeCache(db, appid, 'schema', liveResult)
        live = liveResult
      }
    } catch {
      live = null
    }
  }

  return resolveAchievementSchema({
    forceRefresh,
    freshCache,
    live,
    staleCache
  })
}

interface SteamPercentResponse {
  achievementpercentages?: {
    achievements?: Array<{ name: string; percent: number }>
  }
}

export function getPercentagesFromDb(
  db: Database.Database,
  appid: string
): Record<string, number> | null {
  const existing = getAchievementsForGame(db, appid)
  return achievementPercentagesFromRecords(existing)
}

export async function fetchPercentages(
  db: Database.Database,
  appid: string,
  forceRefresh: boolean
): Promise<Record<string, number> | null> {
  if (!forceRefresh) {
    const fromDb = getPercentagesFromDb(db, appid)
    if (fromDb) return fromDb
  }

  try {
    const url =
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
      `?gameid=${appid}&format=json`
    const body = await httpGet(url)
    const parsed = JSON.parse(body) as SteamPercentResponse
    const list = parsed?.achievementpercentages?.achievements ?? []
    const map: Record<string, number> = {}
    for (const item of list) {
      const percent = Number(item.percent)
      if (!item.name || !Number.isFinite(percent)) continue
      map[item.name] = percent
    }
    return map
  } catch {
    return getPercentagesFromDb(db, appid)
  }
}

interface AppDetailsResponse {
  [appid: string]: {
    success?: boolean
    data?: { name?: string; header_image?: string; steam_appid?: unknown }
  }
}

interface AppDetailsData {
  name: string
  header_image?: string
}

async function fetchAppDetails(
  db: Database.Database,
  appid: string,
  forceRefresh: boolean
): Promise<AppDetailsData | null> {
  if (!forceRefresh) {
    const cached = readCache(db, appid, 'appdetails', APPDETAILS_TTL) as AppDetailsData | null
    if (cached?.name && cached.header_image) return cached
  }

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`
    const body = await httpGet(url)
    const parsed = JSON.parse(body) as AppDetailsResponse
    const data = pickSteamAppDetailsEntry(parsed, appid)
    if (!data?.name) return null
    const result: AppDetailsData = { name: data.name, header_image: data.header_image }
    writeCache(db, appid, 'appdetails', result)
    return result
  } catch {
    return null
  }
}

function getCachedHeaderImage(db: Database.Database, appid: string): string {
  const cached = readCache(db, appid, 'appdetails', APPDETAILS_TTL) as AppDetailsData | null
  return cached?.header_image ?? ''
}

/** Steam Store API header_image — sole source for game cover art. */
export async function getStoreCoverUrl(
  db: Database.Database,
  appid: string,
  forceRefresh = false
): Promise<string> {
  if (!forceRefresh) {
    const cached = getCachedHeaderImage(db, appid)
    if (cached) return cached
  }
  const details = await fetchAppDetails(db, appid, forceRefresh)
  return details?.header_image ?? ''
}

function buildGameRecord(
  appid: string,
  gameName: string,
  achievements: Achievement[],
  schema: SteamSchemaAchievement[] | null,
  existingGame: Game | undefined
): Game {
  const unlocked = achievements.filter((a) => a.earned === 1)
  const total = achievements.length
  const completionPct = total > 0 ? (unlocked.length / total) * 100 : 0
  const hasPlatinum = total > 0 && unlocked.length === total ? 1 : 0
  const lastUnlockedAt =
    unlocked.length > 0 ? Math.max(...unlocked.map((a) => a.earned_time)) : 0

  return {
    appid,
    name: gameName,
    total_achievements: total,
    unlocked_achievements: unlocked.length,
    completion_pct: completionPct,
    has_platinum: hasPlatinum,
    last_unlocked_at: lastUnlockedAt,
    schema_fetched_at: schema ? Math.floor(Date.now() / 1000) : existingGame?.schema_fetched_at ?? 0,
    playtime_seconds: existingGame?.playtime_seconds ?? 0,
    install_path: existingGame?.install_path ?? '',
    launch_exe: existingGame?.launch_exe ?? '',
    launch_args: existingGame?.launch_args ?? '',
    playtime_session_started_at: existingGame?.playtime_session_started_at ?? 0,
    playtime_last_flush_at: existingGame?.playtime_last_flush_at ?? 0,
    manifest_gids: existingGame?.manifest_gids ?? '',
    update_status: existingGame?.update_status ?? '',
    backup_status: existingGame?.backup_status ?? '',
    backup_at: existingGame?.backup_at ?? 0,
    backup_error: existingGame?.backup_error ?? '',
    ludusavi_title: existingGame?.ludusavi_title ?? '',
    cloud_saves_enabled: existingGame?.cloud_saves_enabled ?? 0,
    steamless_applied: existingGame?.steamless_applied ?? 0,
    goldberg_applied: existingGame?.goldberg_applied ?? 0,
    steamless_exe: existingGame?.steamless_exe ?? '',
    goldberg_dll_path: existingGame?.goldberg_dll_path ?? ''
  }
}

export interface EnrichResult {
  game: Game
  achievements: Achievement[]
  /** Basename → absolute path when the catalog came from `steam_settings/achievements.json`. */
  localIconSources?: Map<string, string>
}

export async function enrichApp(
  appid: string,
  apiKey: string,
  mergedRaw: Record<string, RawAchievement>,
  db: Database.Database,
  forceRefresh = false,
  dllDir?: string
): Promise<EnrichResult> {
  const existingGame = getGame(db, appid)
  const isNewGame = !existingGame

  let schema = await fetchSchema(db, appid, apiKey, forceRefresh)
  let localIconSources: Map<string, string> | undefined
  if ((!schema || schema.length === 0) && dllDir?.trim()) {
    const local = readSteamSettingsSchema(dllDir)
    if (local) {
      schema = local.schema
      localIconSources = local.iconSources
    }
  }
  const percentages = await fetchPercentages(db, appid, forceRefresh)

  let gameName = existingGame?.name ?? `Game ${appid}`
  const appDetails = await fetchAppDetails(db, appid, forceRefresh || isNewGame)
  if (appDetails?.name) gameName = appDetails.name

  const achievements = buildAchievementRecords(
    appid,
    mergedRaw,
    schema,
    percentages,
    normalizeSteamIconUrl
  )
  if (!localIconSources) {
    await ensureSteamDbHiddenDescriptions(db, appid, achievements, forceRefresh)
  }

  const game = buildGameRecord(appid, gameName, achievements, schema, existingGame)
  return { game, achievements, localIconSources }
}
