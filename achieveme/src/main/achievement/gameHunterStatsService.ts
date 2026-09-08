/**
 * Fetches Steam Store hunter stats: durable Metacritic + durable reviews caches.
 * Detail uses cache-only; boot / Library / Refresh use forceRefresh.
 */

import https from 'node:https'
import type Database from 'better-sqlite3'
import type { GameHunterStats } from '../../shared/types.ts'
import {
  EMPTY_HUNTER_STATS,
  buildHunterStats,
  isNumericSteamAppId,
  mergeHunterStats,
  parseSteamAppdetailsStats,
  parseSteamAppreviewsSummary
} from '../../shared/hunterStatsUtils.ts'
import { getCacheEntry, setCacheEntry } from '../db/repository.ts'
import { isFresh } from './cacheUtils.ts'
import {
  BOOT_WARM_CONCURRENCY,
  runWithConcurrency
} from '../../shared/bootWarmUtils.ts'

/** Durable Metacritic-only cache. */
export const HUNTER_METACRITIC_CACHE_TYPE = 'hunter_metacritic'
export const HUNTER_METACRITIC_TTL_SECONDS = 604800

/** Durable Steam review summary cache. */
export const HUNTER_REVIEWS_CACHE_TYPE = 'hunter_reviews'
export const HUNTER_REVIEWS_TTL_SECONDS = 604800

/** @deprecated Use HUNTER_METACRITIC_CACHE_TYPE — kept for cover-contract tests naming. */
export const HUNTER_STATS_CACHE_TYPE = HUNTER_METACRITIC_CACHE_TYPE
export const HUNTER_STATS_TTL_SECONDS = HUNTER_METACRITIC_TTL_SECONDS

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

export type GetGameHunterStatsOptions = {
  /** When true, hit Steam and rewrite caches. Default false = cache only. */
  forceRefresh?: boolean
}

type MetacriticCachePayload = { metacritic: number | null }

type ReviewsCachePayload = {
  reviewSummary: string | null
  reviewCount: number | null
  reviewPercent: number | null
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

function buildAppreviewsUrl(appid: string): string {
  return `https://store.steampowered.com/appreviews/${encodeURIComponent(appid)}?json=1&language=all&purchase_type=all&num_per_page=0`
}

function readMetacriticCache(dataJson: string): number | null | undefined {
  try {
    const parsed = JSON.parse(dataJson) as Partial<MetacriticCachePayload> | null
    if (typeof parsed !== 'object' || parsed === null) return undefined
    if (!('metacritic' in parsed)) return undefined
    const score = parsed.metacritic
    if (score === null) return null
    if (typeof score === 'number' && Number.isFinite(score)) return score
    return undefined
  } catch {
    return undefined
  }
}

function readReviewsCache(dataJson: string): ReviewsCachePayload | undefined {
  try {
    const parsed = JSON.parse(dataJson) as Partial<ReviewsCachePayload> | null
    if (typeof parsed !== 'object' || parsed === null) return undefined
    return {
      reviewSummary:
        typeof parsed.reviewSummary === 'string' ? parsed.reviewSummary : null,
      reviewCount:
        typeof parsed.reviewCount === 'number' && Number.isFinite(parsed.reviewCount)
          ? parsed.reviewCount
          : null,
      reviewPercent:
        typeof parsed.reviewPercent === 'number' && Number.isFinite(parsed.reviewPercent)
          ? parsed.reviewPercent
          : null
    }
  } catch {
    return undefined
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

async function fetchLeg(
  httpGetFn: (url: string) => Promise<string>,
  url: string
): Promise<string | null> {
  try {
    return await httpGetFn(url)
  } catch {
    return null
  }
}

/**
 * True when reviews cache is missing or past TTL (Library warm should refetch).
 */
export function needsHunterReviewsWarm(
  db: Database.Database,
  appid: string,
  deps?: Partial<HunterStatsDeps>
): boolean {
  if (!isNumericSteamAppId(appid)) return false
  const resolved = resolveDeps(db, deps)
  const row = resolved.getCache(appid, HUNTER_REVIEWS_CACHE_TYPE)
  if (!row) return true
  return !isCacheFresh(
    row.cached_at,
    HUNTER_REVIEWS_TTL_SECONDS,
    resolved.nowSeconds
  )
}

function readCachedHunterStats(
  resolved: HunterStatsDeps,
  appid: string
): GameHunterStats {
  const mcRow = resolved.getCache(appid, HUNTER_METACRITIC_CACHE_TYPE)
  const reviewsRow = resolved.getCache(appid, HUNTER_REVIEWS_CACHE_TYPE)

  const metacritic =
    mcRow !== null ? (readMetacriticCache(mcRow.data_json) ?? null) : null
  const fromMc = buildHunterStats(null, null, metacritic, null)

  const fromReviews =
    reviewsRow !== null
      ? (readReviewsCache(reviewsRow.data_json) ?? {
          reviewSummary: null,
          reviewCount: null,
          reviewPercent: null
        })
      : { reviewSummary: null, reviewCount: null, reviewPercent: null }

  return mergeHunterStats(fromMc, fromReviews)
}

/**
 * Returns hunter stats from cache, or live Steam when forceRefresh is true.
 */
export async function getGameHunterStats(
  db: Database.Database,
  appid: string,
  deps?: Partial<HunterStatsDeps>,
  options?: GetGameHunterStatsOptions
): Promise<GameHunterStats> {
  if (!isNumericSteamAppId(appid)) {
    return EMPTY_HUNTER_STATS
  }

  const forceRefresh = Boolean(options?.forceRefresh)
  const resolved = resolveDeps(db, deps)

  if (!forceRefresh) {
    return readCachedHunterStats(resolved, appid)
  }

  const detailsUrl = buildAppDetailsUrl(appid)
  const reviewsUrl = buildAppreviewsUrl(appid)

  const [detailsBody, reviewsBody] = await Promise.all([
    fetchLeg(resolved.httpGet, detailsUrl),
    fetchLeg(resolved.httpGet, reviewsUrl)
  ])

  const fromDetails = detailsBody
    ? parseSteamAppdetailsStats(detailsBody, appid)
    : EMPTY_HUNTER_STATS

  resolved.setCache(appid, HUNTER_METACRITIC_CACHE_TYPE, {
    metacritic: fromDetails.metacritic
  } satisfies MetacriticCachePayload)

  const fromReviews = reviewsBody
    ? parseSteamAppreviewsSummary(reviewsBody)
    : { reviewSummary: null, reviewCount: null, reviewPercent: null }

  resolved.setCache(appid, HUNTER_REVIEWS_CACHE_TYPE, {
    reviewSummary: fromReviews.reviewSummary,
    reviewCount: fromReviews.reviewCount,
    reviewPercent: fromReviews.reviewPercent
  } satisfies ReviewsCachePayload)

  return mergeHunterStats(fromDetails, fromReviews)
}

/**
 * Warms hunter caches for library appids whose reviews are missing/stale.
 * Concurrency 3; fail-soft; coalesced.
 */
export async function warmHunterLibrary(
  db: Database.Database,
  appids: readonly string[],
  deps?: Partial<HunterStatsDeps>
): Promise<{ warmed: number; skipped: number; failed: number }> {
  const ids = appids.filter((id) => isNumericSteamAppId(id))
  let warmed = 0
  let skipped = 0
  let failed = 0

  await runWithConcurrency(ids, BOOT_WARM_CONCURRENCY, async (appid) => {
    try {
      if (!needsHunterReviewsWarm(db, appid, deps)) {
        skipped += 1
        return
      }
      await getGameHunterStats(db, appid, deps, { forceRefresh: true })
      warmed += 1
    } catch {
      failed += 1
    }
  })

  return { warmed, skipped, failed }
}

let hunterLibraryInflight: Promise<{
  warmed: number
  skipped: number
  failed: number
}> | null = null

/**
 * Coalesces concurrent library hunter warms into one run.
 */
export function startWarmHunterLibrary(
  db: Database.Database,
  appids: readonly string[],
  deps?: Partial<HunterStatsDeps>
): Promise<{ warmed: number; skipped: number; failed: number }> {
  if (hunterLibraryInflight) return hunterLibraryInflight
  hunterLibraryInflight = warmHunterLibrary(db, appids, deps).finally(() => {
    hunterLibraryInflight = null
  })
  return hunterLibraryInflight
}

/** Test helper — clears coalesce lock. */
export function resetWarmHunterLibraryInflightForTest(): void {
  hunterLibraryInflight = null
}
