/**
 * Fetches Steam Store hunter stats for Game Detail (separate from basic appdetails cache).
 */

import https from 'node:https'
import type Database from 'better-sqlite3'
import type { GameHunterStats } from '../../shared/types.ts'
import {
  EMPTY_HUNTER_STATS,
  isNumericSteamAppId,
  parseSteamAppdetailsStats
} from '../../shared/hunterStatsUtils.ts'
import { getCacheEntry, setCacheEntry } from '../db/repository.ts'
import { isFresh } from './cacheUtils.ts'

export const HUNTER_STATS_CACHE_TYPE = 'appdetails_stats'
export const HUNTER_STATS_TTL_SECONDS = 86400

const USER_AGENT = 'AchieveMe/1.0'

export type HunterStatsDeps = {
  httpGet: (url: string) => Promise<string>
  getCache: (
    appid: string,
    type: string
  ) => { data_json: string; cached_at: number } | null
  setCache: (appid: string, type: string, data: unknown) => void
  nowSeconds?: () => number
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function buildAppDetailsUrl(appid: string): string {
  return `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&filters=basic,metacritic,recommendations`
}

function readCachedStats(dataJson: string): GameHunterStats | null {
  try {
    return JSON.parse(dataJson) as GameHunterStats
  } catch {
    return null
  }
}

function isCacheFresh(
  cachedAt: number,
  ttlSeconds: number,
  nowSeconds?: () => number
): boolean {
  if (nowSeconds) {
    return nowSeconds() - cachedAt < ttlSeconds
  }
  return isFresh(cachedAt, ttlSeconds)
}

function resolveDeps(
  db: Database.Database,
  partial?: Partial<HunterStatsDeps>
): HunterStatsDeps {
  return {
    httpGet: partial?.httpGet ?? httpGet,
    getCache:
      partial?.getCache ??
      ((appid, type) => {
        const row = getCacheEntry(db, appid, type)
        return row ?? null
      }),
    setCache:
      partial?.setCache ??
      ((appid, type, data) => {
        setCacheEntry(db, appid, type, JSON.stringify(data))
      }),
    nowSeconds: partial?.nowSeconds
  }
}

/**
 * Returns hunter stats for a Steam appid, using `appdetails_stats` cache with 1-day TTL.
 * Fail-soft: stale cache on HTTP error; empty stats for invalid appids or total miss.
 */
export async function getGameHunterStats(
  db: Database.Database,
  appid: string,
  deps?: Partial<HunterStatsDeps>
): Promise<GameHunterStats> {
  if (!isNumericSteamAppId(appid)) {
    return EMPTY_HUNTER_STATS
  }

  const resolved = resolveDeps(db, deps)
  const cached = resolved.getCache(appid, HUNTER_STATS_CACHE_TYPE)

  if (
    cached &&
    isCacheFresh(cached.cached_at, HUNTER_STATS_TTL_SECONDS, resolved.nowSeconds)
  ) {
    const stats = readCachedStats(cached.data_json)
    if (stats) {
      return stats
    }
  }

  const url = buildAppDetailsUrl(appid)

  try {
    const body = await resolved.httpGet(url)
    const stats = parseSteamAppdetailsStats(body, appid)
    resolved.setCache(appid, HUNTER_STATS_CACHE_TYPE, stats)
    return stats
  } catch {
    if (cached) {
      const stale = readCachedStats(cached.data_json)
      if (stale) {
        return stale
      }
    }
    return EMPTY_HUNTER_STATS
  }
}
