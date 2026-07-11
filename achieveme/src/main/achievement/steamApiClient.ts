import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { app } from 'electron'
import type { Achievement, Game } from '../../shared/types'
import { getCacheEntry, setCacheEntry } from '../db/repository'
import type Database from 'better-sqlite3'

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

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

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve()
      return
    }
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const file = fs.createWriteStream(destPath)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
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
  description: string
  icon: string
  icongray: string
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
  apiKey: string
): Promise<SteamSchemaAchievement[] | null> {
  const TTL = 604800

  const cached = readCache(db, appid, 'schema', TTL)
  if (cached) return cached as SteamSchemaAchievement[]

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
  const TTL = 86400

  if (!forceRefresh) {
    const cached = readCache(db, appid, 'percentages', TTL)
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
    data?: { name?: string }
  }
}

async function fetchAppName(db: Database.Database, appid: string): Promise<string | null> {
  const TTL = 604800

  const cached = readCache(db, appid, 'appdetails', TTL)
  if (cached) return (cached as { name: string }).name ?? null

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`
    const body = await httpGet(url)
    const parsed = JSON.parse(body) as AppDetailsResponse
    const name = parsed?.[appid]?.data?.name ?? null
    if (name) writeCache(db, appid, 'appdetails', { name })
    return name
  } catch {
    return null
  }
}

const COVER_URLS = (appid: string): string[] => [
  `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
  `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
  `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
]

async function downloadCover(appid: string): Promise<string> {
  const coverDir = path.join(app.getPath('userData'), 'covers')
  ensureDir(coverDir)
  const destPath = path.join(coverDir, `${appid}.jpg`)

  if (fs.existsSync(destPath)) return destPath

  for (const url of COVER_URLS(appid)) {
    try {
      await downloadFile(url, destPath)
      return destPath
    } catch {
      // try next
    }
  }

  return ''
}

async function downloadIcon(appid: string, apiName: string, iconUrl: string): Promise<string> {
  if (!iconUrl) return ''
  const iconDir = path.join(app.getPath('userData'), 'icons', appid)
  ensureDir(iconDir)
  const destPath = path.join(iconDir, `${apiName}.jpg`)
  try {
    await downloadFile(iconUrl, destPath)
    return destPath
  } catch {
    return ''
  }
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
  const schema = await fetchSchema(db, appid, apiKey)
  const percentages = await fetchPercentages(db, appid, forceRefresh)

  let gameName = `Game ${appid}`
  if (schema && schema.length > 0) {
    // Schema doesn't include game name — fetch separately
    const fetched = await fetchAppName(db, appid)
    if (fetched) gameName = fetched
  } else if (!schema) {
    const fetched = await fetchAppName(db, appid)
    if (fetched) gameName = fetched
  }

  const coverPath = await downloadCover(appid)

  const achievements: Achievement[] = []

  // Build achievement list from schema if we have it, otherwise from mergedRaw keys
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

    const iconUrl = schemaEntry?.icon ?? ''
    const iconGrayUrl = schemaEntry?.icongray ?? ''

    // Only download icon for earned achievements
    let localIconUrl = iconUrl
    if (earned && iconUrl) {
      localIconUrl = await downloadIcon(appid, apiName, iconUrl)
    }

    achievements.push({
      appid,
      api_name: apiName,
      display_name: schemaEntry?.displayName ?? apiName,
      description: schemaEntry?.description ?? '',
      icon_url: localIconUrl,
      icon_gray_url: iconGrayUrl,
      global_percent: globalPercent,
      earned,
      earned_time: earnedTime,
      trophy_tier: tier
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
    cover_path: coverPath,
    total_achievements: total,
    unlocked_achievements: unlocked.length,
    completion_pct: completionPct,
    has_platinum: hasPlatinum,
    last_unlocked_at: lastUnlockedAt,
    schema_fetched_at: schema ? Math.floor(Date.now() / 1000) : 0
  }

  return { game, achievements }
}
