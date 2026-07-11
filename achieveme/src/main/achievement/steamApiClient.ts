import https from 'node:https'
import type { Achievement, Game } from '../../shared/types'
import { normalizeSteamIconUrl } from '../../shared/steamUrls'
import {
  getCacheEntry,
  setCacheEntry,
  getGame
} from '../db/repository'
import type Database from 'better-sqlite3'

const SCHEMA_TTL = 604800
const PERCENTAGES_TTL = 86400
const APPDETAILS_TTL = 604800

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function isFresh(cachedAt: number, ttlSeconds: number): boolean {
  return Math.floor(Date.now() / 1000) - cachedAt < ttlSeconds
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

interface SteamSchemaAchievement {
  name: string
  displayName: string
  description?: string
  icon: string
  icongray: string
  hidden?: number
}

interface SteamSchemaResponse {
  game?: {
    availableGameStats?: {
      achievements?: SteamSchemaAchievement[]
    }
  }
}

async function fetchSchema(
  db: Database.Database,
  appid: string,
  apiKey: string,
  forceRefresh: boolean
): Promise<SteamSchemaAchievement[] | null> {
  if (!forceRefresh) {
    const cached = readCache(db, appid, 'schema', SCHEMA_TTL)
    if (cached) return cached as SteamSchemaAchievement[]
  }

  if (!apiKey) return null

  try {
    const url =
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
      `?key=${apiKey}&appid=${appid}&format=json`
    const body = await httpGet(url)
    const parsed = JSON.parse(body) as SteamSchemaResponse
    const achievements = parsed?.game?.availableGameStats?.achievements ?? null
    if (achievements) writeCache(db, appid, 'schema', achievements)
    return achievements
  } catch {
    return null
  }
}

interface SteamPercentResponse {
  achievementpercentages?: {
    achievements?: Array<{ name: string; percent: number }>
  }
}

async function fetchPercentages(
  db: Database.Database,
  appid: string,
  forceRefresh: boolean
): Promise<Record<string, number> | null> {
  if (!forceRefresh) {
    const cached = readCache(db, appid, 'percentages', PERCENTAGES_TTL)
    if (cached) return cached as Record<string, number>
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
      map[item.name] = item.percent
    }
    writeCache(db, appid, 'percentages', map)
    return map
  } catch {
    return null
  }
}

interface AppDetailsResponse {
  [appid: string]: {
    success: boolean
    data?: { name?: string; header_image?: string }
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
    const data = parsed?.[appid]?.data
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

function getTrophyTier(globalPercent: number): 'gold' | 'silver' | 'bronze' {
  if (globalPercent < 20) return 'gold'
  if (globalPercent < 40) return 'silver'
  return 'bronze'
}

export interface EnrichResult {
  game: Game
  achievements: Achievement[]
}

export async function enrichApp(
  appid: string,
  apiKey: string,
  mergedRaw: Record<string, { achieved: boolean; unlockTime: number }>,
  db: Database.Database,
  forceRefresh = false
): Promise<EnrichResult> {
  const existingGame = getGame(db, appid)
  const isNewGame = !existingGame

  const schema = await fetchSchema(db, appid, apiKey, forceRefresh)
  const percentages = await fetchPercentages(db, appid, forceRefresh)

  let gameName = existingGame?.name ?? `Game ${appid}`
  const appDetails = await fetchAppDetails(db, appid, forceRefresh || isNewGame)
  if (appDetails?.name) gameName = appDetails.name

  const achievements: Achievement[] = []
  const schemaMap = new Map<string, SteamSchemaAchievement>()
  if (schema) {
    for (const s of schema) schemaMap.set(s.name, s)
  }

  const apiNames = schema ? schema.map((s) => s.name) : Object.keys(mergedRaw)

  for (const apiName of apiNames) {
    const raw = mergedRaw[apiName]
    const earned = raw?.achieved ? 1 : 0
    const earnedTime = raw?.unlockTime ?? 0

    const schemaEntry = schemaMap.get(apiName)
    const globalPercent = percentages?.[apiName] ?? 0
    const tier = getTrophyTier(globalPercent)

    const colorIconUrl = normalizeSteamIconUrl(appid, schemaEntry?.icon ?? '')
    const grayIconUrl =
      normalizeSteamIconUrl(appid, schemaEntry?.icongray ?? '') || colorIconUrl

    achievements.push({
      appid,
      api_name: apiName,
      display_name: schemaEntry?.displayName ?? apiName,
      description: schemaEntry?.description ?? '',
      icon_url: earned ? colorIconUrl : '',
      icon_gray_url: grayIconUrl,
      global_percent: globalPercent,
      earned,
      earned_time: earnedTime,
      trophy_tier: tier,
      hidden: schemaEntry?.hidden === 1 ? 1 : 0
    })
  }

  const unlocked = achievements.filter((a) => a.earned === 1)
  const total = achievements.length
  const completionPct = total > 0 ? (unlocked.length / total) * 100 : 0
  const hasPlatinum = total > 0 && unlocked.length === total ? 1 : 0
  const lastUnlockedAt =
    unlocked.length > 0 ? Math.max(...unlocked.map((a) => a.earned_time)) : 0

  const game: Game = {
    appid,
    name: gameName,
    total_achievements: total,
    unlocked_achievements: unlocked.length,
    completion_pct: completionPct,
    has_platinum: hasPlatinum,
    last_unlocked_at: lastUnlockedAt,
    schema_fetched_at: schema ? Math.floor(Date.now() / 1000) : existingGame?.schema_fetched_at ?? 0
  }

  return { game, achievements }
}
