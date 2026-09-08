import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  getGameHunterStats,
  needsHunterReviewsWarm,
  HUNTER_METACRITIC_CACHE_TYPE,
  HUNTER_REVIEWS_CACHE_TYPE,
  HUNTER_STATS_CACHE_TYPE,
  HUNTER_METACRITIC_TTL_SECONDS,
  HUNTER_REVIEWS_TTL_SECONDS
} = await import(
  pathToFileURL(
    path.join(rootDir, '../src/main/achievement/gameHunterStatsService.ts')
  ).href
)
const { EMPTY_HUNTER_STATS } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/hunterStatsUtils.ts')).href
)

const mockDb = {}

function makeDeps(options = {}) {
  const cache = new Map()
  let httpCalls = 0
  /** @type {string[]} */
  const urls = []

  const getCache = (appid, type) => {
    const key = `${appid}:${type}`
    return cache.get(key) ?? null
  }

  const setCache = (appid, type, data) => {
    const key = `${appid}:${type}`
    cache.set(key, {
      data_json: JSON.stringify(data),
      cached_at: Math.floor(Date.now() / 1000)
    })
  }

  const seedCache = (appid, type, data, cachedAt) => {
    const key = `${appid}:${type}`
    cache.set(key, {
      data_json: JSON.stringify(data),
      cached_at: cachedAt
    })
  }

  const httpGet = async (url) => {
    httpCalls += 1
    urls.push(url)
    if (options.httpGet) {
      return options.httpGet(url)
    }
    throw new Error(`unexpected http: ${url}`)
  }

  return {
    deps: { httpGet, getCache, setCache },
    httpCalls: () => httpCalls,
    capturedUrls: () => urls,
    seedCache,
    cache
  }
}

const detailsBody = JSON.stringify({
  570: {
    success: true,
    data: {
      metacritic: { score: 90 },
      recommendations: { total: 5000 }
    }
  }
})

const reviewsBody = JSON.stringify({
  success: 1,
  query_summary: {
    review_score_desc: 'Very Positive',
    total_positive: 4500,
    total_negative: 500,
    total_reviews: 5000
  }
})

test('non-numeric appid returns EMPTY without http', async () => {
  const { deps, httpCalls } = makeDeps()
  const result = await getGameHunterStats(mockDb, 'not-a-game', deps)
  assert.deepEqual(result, EMPTY_HUNTER_STATS)
  assert.equal(httpCalls(), 0)
})

test('cache-only reads both caches with zero HTTP', async () => {
  const now = Math.floor(Date.now() / 1000)
  const { deps, httpCalls, seedCache } = makeDeps({
    httpGet: async () => {
      throw new Error('should not http')
    }
  })
  seedCache('570', HUNTER_METACRITIC_CACHE_TYPE, { metacritic: 84 }, now - 100)
  seedCache(
    '570',
    HUNTER_REVIEWS_CACHE_TYPE,
    {
      reviewSummary: 'Very Positive',
      reviewCount: 5000,
      reviewPercent: 90
    },
    now - 100
  )

  const result = await getGameHunterStats(mockDb, '570', deps, {
    forceRefresh: false
  })

  assert.equal(httpCalls(), 0)
  assert.equal(result.metacritic, 84)
  assert.equal(result.reviewSummary, 'Very Positive')
  assert.equal(result.reviewCount, 5000)
  assert.equal(result.hasAny, true)
})

test('cache-only with empty caches returns EMPTY without http', async () => {
  const { deps, httpCalls } = makeDeps()
  const result = await getGameHunterStats(mockDb, '570', deps)
  assert.deepEqual(result, EMPTY_HUNTER_STATS)
  assert.equal(httpCalls(), 0)
})

test('forceRefresh fetches both and writes hunter_metacritic + hunter_reviews', async () => {
  const setCacheCalls = []
  const deps = {
    httpGet: async (url) => {
      if (url.includes('appreviews')) return reviewsBody
      return detailsBody
    },
    getCache: () => null,
    setCache: (appid, type, data) => {
      setCacheCalls.push({ appid, type, data })
    }
  }

  const result = await getGameHunterStats(mockDb, '570', deps, {
    forceRefresh: true
  })

  assert.equal(result.metacritic, 90)
  assert.equal(result.reviewSummary, 'Very Positive')
  assert.equal(setCacheCalls.length, 2)
  const types = setCacheCalls.map((c) => c.type).sort()
  assert.deepEqual(types, [HUNTER_METACRITIC_CACHE_TYPE, HUNTER_REVIEWS_CACHE_TYPE].sort())
  assert.equal(HUNTER_STATS_CACHE_TYPE, 'hunter_metacritic')
  const reviewsWrite = setCacheCalls.find((c) => c.type === HUNTER_REVIEWS_CACHE_TYPE)
  assert.deepEqual(reviewsWrite.data, {
    reviewSummary: 'Very Positive',
    reviewCount: 5000,
    reviewPercent: 90
  })
})

test('forceRefresh reviews failure still returns metacritic from details', async () => {
  const { deps } = makeDeps({
    httpGet: async (url) => {
      if (url.includes('appreviews')) throw new Error('network')
      return detailsBody
    }
  })

  const result = await getGameHunterStats(mockDb, '570', deps, {
    forceRefresh: true
  })
  assert.equal(result.metacritic, 90)
  assert.equal(result.reviewSummary, null)
  assert.equal(result.hasAny, true)
})

test('forceRefresh both legs fail returns EMPTY', async () => {
  const { deps } = makeDeps({
    httpGet: async () => {
      throw new Error('network')
    }
  })
  const result = await getGameHunterStats(mockDb, '570', deps, {
    forceRefresh: true
  })
  assert.deepEqual(result, EMPTY_HUNTER_STATS)
})

test('needsHunterReviewsWarm is true when missing or stale', () => {
  const now = Math.floor(Date.now() / 1000)
  const { deps, seedCache } = makeDeps()
  assert.equal(needsHunterReviewsWarm(mockDb, '570', deps), true)
  seedCache(
    '570',
    HUNTER_REVIEWS_CACHE_TYPE,
    { reviewSummary: 'Mixed', reviewCount: 1, reviewPercent: null },
    now - 100
  )
  assert.equal(needsHunterReviewsWarm(mockDb, '570', deps), false)
  seedCache(
    '570',
    HUNTER_REVIEWS_CACHE_TYPE,
    { reviewSummary: 'Mixed', reviewCount: 1, reviewPercent: null },
    now - HUNTER_REVIEWS_TTL_SECONDS - 10
  )
  assert.equal(needsHunterReviewsWarm(mockDb, '570', deps), true)
})

test('TTL constants are seven days', () => {
  assert.equal(HUNTER_METACRITIC_TTL_SECONDS, 604800)
  assert.equal(HUNTER_REVIEWS_TTL_SECONDS, 604800)
})
