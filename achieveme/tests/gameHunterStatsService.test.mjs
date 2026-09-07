import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  getGameHunterStats,
  HUNTER_STATS_CACHE_TYPE,
  HUNTER_STATS_TTL_SECONDS
} = await import(
  pathToFileURL(
    path.join(rootDir, '../src/main/achievement/gameHunterStatsService.ts')
  ).href
)
const { EMPTY_HUNTER_STATS } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/hunterStatsUtils.ts')).href
)

const mockDb = {}

/**
 * @param {object} [options]
 * @param {(url: string) => Promise<string>} [options.httpGet]
 */
function makeDeps(options = {}) {
  const cache = new Map()
  let httpCalls = 0

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
    if (options.httpGet) {
      return options.httpGet(url)
    }
    throw new Error(`unexpected http: ${url}`)
  }

  return {
    deps: { httpGet, getCache, setCache },
    httpCalls: () => httpCalls,
    seedCache,
    cache
  }
}

test('non-numeric appid returns EMPTY_HUNTER_STATS without http', async () => {
  const { deps, httpCalls } = makeDeps()
  const result = await getGameHunterStats(mockDb, 'not-a-game', deps)
  assert.deepEqual(result, EMPTY_HUNTER_STATS)
  assert.equal(httpCalls(), 0)
})

test('fresh cache hit skips http', async () => {
  const stats = {
    reviewPercent: 90,
    reviewCount: 1000,
    metacritic: 85,
    hasAny: true
  }
  const now = Math.floor(Date.now() / 1000)
  const { deps, httpCalls, seedCache } = makeDeps()
  seedCache('570', HUNTER_STATS_CACHE_TYPE, stats, now - 100)

  const result = await getGameHunterStats(mockDb, '570', deps)

  assert.deepEqual(result, stats)
  assert.equal(httpCalls(), 0)
})

test('cache miss fetches appdetails with hunter filters', async () => {
  const body = JSON.stringify({
    570: {
      success: true,
      data: {
        metacritic: { score: 90 },
        recommendations: { total: 5000 }
      }
    }
  })
  let capturedUrl = ''
  const { deps, httpCalls } = makeDeps({
    httpGet: async (url) => {
      capturedUrl = url
      return body
    }
  })

  const result = await getGameHunterStats(mockDb, '570', deps)

  assert.equal(httpCalls(), 1)
  assert.match(capturedUrl, /appids=570/)
  assert.match(capturedUrl, /filters=basic,metacritic,recommendations/)
  assert.equal(result.metacritic, 90)
  assert.equal(result.reviewCount, 5000)
  assert.equal(result.hasAny, true)
})

test('http failure returns stale cache when present', async () => {
  const stats = {
    reviewPercent: 80,
    reviewCount: 200,
    metacritic: 70,
    hasAny: true
  }
  const staleAt =
    Math.floor(Date.now() / 1000) - HUNTER_STATS_TTL_SECONDS - 100
  const { deps, httpCalls, seedCache } = makeDeps({
    httpGet: async () => {
      throw new Error('network')
    }
  })
  seedCache('570', HUNTER_STATS_CACHE_TYPE, stats, staleAt)

  const result = await getGameHunterStats(mockDb, '570', deps)

  assert.deepEqual(result, stats)
  assert.equal(httpCalls(), 1)
})

test('http failure returns EMPTY when no cache', async () => {
  const { deps, httpCalls } = makeDeps({
    httpGet: async () => {
      throw new Error('network')
    }
  })

  const result = await getGameHunterStats(mockDb, '570', deps)

  assert.deepEqual(result, EMPTY_HUNTER_STATS)
  assert.equal(httpCalls(), 1)
})

test('successful fetch writes appdetails_stats cache only', async () => {
  const body = JSON.stringify({
    570: {
      success: true,
      data: { metacritic: { score: 88 } }
    }
  })
  const setCacheCalls = []
  let httpCalls = 0

  const deps = {
    httpGet: async () => {
      httpCalls += 1
      return body
    },
    getCache: () => null,
    setCache: (appid, type, data) => {
      setCacheCalls.push({ appid, type, data })
    }
  }

  await getGameHunterStats(mockDb, '570', deps)

  assert.equal(httpCalls, 1)
  assert.equal(setCacheCalls.length, 1)
  assert.equal(setCacheCalls[0].type, HUNTER_STATS_CACHE_TYPE)
  assert.equal(setCacheCalls[0].type, 'appdetails_stats')
  assert.equal(setCacheCalls[0].appid, '570')
  assert.notEqual(setCacheCalls[0].type, 'appdetails')
  assert.equal(setCacheCalls[0].data.metacritic, 88)
})
