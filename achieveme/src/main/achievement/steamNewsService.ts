/**
 * Fetches popular Steam releases (this week / this month) and library game news.
 *
 * Popularity gate: Steam's public popular-wishlist chart (exact wishlist counts
 * are not published). Chart membership is the "popular enough" filter.
 * Results are always limited to games (`category1=998`).
 */

import https from 'node:https'
import type Database from 'better-sqlite3'
import type { LibraryNewsItem, NewsPayload, NewsRelease } from '../../shared/types'
import { parseSearchResultsHtml } from '../../shared/newsHtml'
import {
  bucketRelease,
  dedupeReleasesByAppid,
  parseSteamReleaseLabel,
  pickLibraryNewsAppids
} from '../../shared/newsUtils'
import { getAllGames, getCacheEntry, setCacheEntry } from '../db/repository'
import { isFresh } from './cacheUtils'

const NEWS_TTL = 3600
const CACHE_APPID = '__steam_news__'
const USER_AGENT = 'AchieveMe/1.0'

const PAGE_SIZE = 50
/** Top pages of Steam popular-wishlist chart (~50 each). Keep low to avoid Steam 429. */
const POPULAR_WISHLIST_PAGES = 8
const LIBRARY_NEWS_LIMIT = 20
const NEWS_PER_APP = 3
const FETCH_CONCURRENCY = 4

interface SearchPageJson {
  results_html?: string
  total_count?: number
}

interface SteamNewsApiItem {
  title?: string
  url?: string
  date?: number
  contents?: string
  feedlabel?: string
  feed_label?: string
}

interface SteamNewsApiResponse {
  appnews?: {
    newsitems?: SteamNewsApiItem[]
  }
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

function readCacheAny(db: Database.Database, type: string): unknown | null {
  const row = getCacheEntry(db, CACHE_APPID, type)
  if (!row) return null
  try {
    return JSON.parse(row.data_json)
  } catch {
    return null
  }
}

function readCacheFresh(db: Database.Database, type: string): unknown | null {
  const row = getCacheEntry(db, CACHE_APPID, type)
  if (!row || !isFresh(row.cached_at, NEWS_TTL)) return null
  try {
    return JSON.parse(row.data_json)
  } catch {
    return null
  }
}

function writeCache(db: Database.Database, type: string, data: unknown): void {
  setCacheEntry(db, CACHE_APPID, type, JSON.stringify(data))
}

function popularWishlistUrl(start: number): string {
  return (
    `https://store.steampowered.com/search/results/?infinite=1` +
    `&cc=US&l=english&start=${start}&count=${PAGE_SIZE}` +
    `&filter=popularwishlist&category1=998`
  )
}

function newsUrl(appid: string): string {
  return (
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/` +
    `?appid=${encodeURIComponent(appid)}&count=${NEWS_PER_APP}` +
    `&maxlength=180&feeds=steam_community_announcements`
  )
}

async function fetchSearchPage(url: string): Promise<ReturnType<typeof parseSearchResultsHtml>> {
  const body = await httpGet(url)
  const json = JSON.parse(body) as SearchPageJson
  return parseSearchResultsHtml(String(json.results_html || ''))
}

/**
 * Loads Steam's popular-wishlist chart in rank order.
 * Exact wishlist counts are not public; this chart is the popularity gate.
 * On mid-fetch Steam errors (e.g. 429), keeps any pages already collected.
 */
async function fetchPopularWishlistChart(
  db: Database.Database,
  forceRefresh: boolean
): Promise<{ items: ReturnType<typeof parseSearchResultsHtml>; fromCache: boolean }> {
  const cacheType = 'popularwishlist_v3'
  if (!forceRefresh) {
    const fresh = readCacheFresh(db, cacheType) as ReturnType<typeof parseSearchResultsHtml> | null
    if (fresh) return { items: fresh, fromCache: true }
  }

  const pages: ReturnType<typeof parseSearchResultsHtml>[] = []
  let partialError: string | null = null

  for (let i = 0; i < POPULAR_WISHLIST_PAGES; i++) {
    const start = i * PAGE_SIZE
    try {
      pages.push(await fetchSearchPage(popularWishlistUrl(start)))
    } catch (pageErr) {
      partialError = String(pageErr instanceof Error ? pageErr.message : pageErr)
      break
    }
  }

  if (pages.length > 0) {
    const items = dedupeReleasesByAppid(pages.flat())
    writeCache(db, cacheType, items)
    return { items, fromCache: false }
  }

  const stale = readCacheAny(db, cacheType) as ReturnType<typeof parseSearchResultsHtml> | null
  if (stale) return { items: stale, fromCache: true }
  throw new Error(partialError || 'Failed to fetch Steam popular wishlist')
}

function toNewsRelease(
  row: ReturnType<typeof parseSearchResultsHtml>[number],
  libraryIds: Set<string>,
  now: Date
): NewsRelease {
  const releaseUnix = parseSteamReleaseLabel(row.releaseLabel, now)
  return {
    appid: row.appid,
    name: row.name,
    releaseLabel: row.releaseLabel || 'Coming soon',
    headerImage: row.headerImage,
    releaseUnix,
    inLibrary: libraryIds.has(row.appid),
    tagIds: Array.isArray(row.tagIds) ? row.tagIds : []
  }
}

function mapAppNews(
  appid: string,
  gameName: string,
  items: SteamNewsApiItem[]
): LibraryNewsItem[] {
  const out: LibraryNewsItem[] = []
  for (const item of items) {
    const title = String(item.title || '').trim()
    const url = String(item.url || '').trim()
    const date = Number(item.date) || 0
    if (!title || !url || !date) continue
    out.push({
      appid,
      gameName,
      title,
      url,
      date,
      contents: String(item.contents || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      feedLabel: String(item.feedlabel || item.feed_label || '').trim()
    })
  }
  return out
}

async function fetchAppNews(
  db: Database.Database,
  appid: string,
  gameName: string,
  forceRefresh: boolean
): Promise<{ items: LibraryNewsItem[]; fromCache: boolean }> {
  const cacheType = `news:${appid}`
  if (!forceRefresh) {
    const fresh = readCacheFresh(db, cacheType) as LibraryNewsItem[] | null
    if (fresh) return { items: fresh, fromCache: true }
  }

  try {
    const body = await httpGet(newsUrl(appid))
    const json = JSON.parse(body) as SteamNewsApiResponse
    const raw = json.appnews?.newsitems || []
    const items = mapAppNews(appid, gameName, raw)
    writeCache(db, cacheType, items)
    return { items, fromCache: false }
  } catch {
    const stale = readCacheAny(db, cacheType) as LibraryNewsItem[] | null
    if (stale) {
      return {
        items: stale.map((row) => ({ ...row, gameName: gameName || row.gameName })),
        fromCache: true
      }
    }
    return { items: [], fromCache: false }
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * Builds the News page payload: popular releases this week / this month + library news.
 *
 * @param db - Open SQLite database.
 * @param forceRefresh - When true, bypass TTL and refetch.
 */
export async function getNews(
  db: Database.Database,
  forceRefresh = false
): Promise<NewsPayload> {
  const now = new Date()
  const games = getAllGames(db)
  const libraryIds = new Set(games.map((g) => g.appid))
  const nameById = new Map(games.map((g) => [g.appid, g.name]))

  const popular = await fetchPopularWishlistChart(db, forceRefresh)

  const thisWeek: NewsRelease[] = []
  const thisMonth: NewsRelease[] = []

  for (const row of popular.items) {
    const release = toNewsRelease(row, libraryIds, now)
    const bucket = bucketRelease(release.releaseUnix, now)
    // This week = releasing soon or released within the last 7 days.
    if (bucket === 'thisWeek' || bucket === 'releasedThisWeek') {
      thisWeek.push(release)
    } else if (bucket === 'thisMonth') {
      thisMonth.push(release)
    }
  }

  const newsAppids = pickLibraryNewsAppids(games, LIBRARY_NEWS_LIMIT)
  let libraryFromCache = newsAppids.length === 0
  const newsResults = await mapPool(newsAppids, FETCH_CONCURRENCY, async (appid) => {
    const result = await fetchAppNews(db, appid, nameById.get(appid) || `App ${appid}`, forceRefresh)
    if (result.fromCache) libraryFromCache = true
    return result.items
  })

  const libraryNews = newsResults.flat().sort((a, b) => b.date - a.date)

  return {
    thisWeek,
    thisMonth,
    libraryNews,
    fetchedAt: Math.floor(Date.now() / 1000),
    fromCache: popular.fromCache && (newsAppids.length === 0 || libraryFromCache)
  }
}
