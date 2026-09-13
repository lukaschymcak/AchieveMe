import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { pruneObsoleteAppData, listImageAppidDirs } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/appDataPruneService.ts')).href
)
const { setCacheEntry, getCacheEntry, getAllGameAppids } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

/**
 * Minimal better-sqlite3-shaped store for prune tests (avoids Electron-native ABI).
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb() {
  /** @type {Map<string, { appid: string, type: string, data_json: string, cached_at: number }>} */
  const cache = new Map()
  /** @type {Set<string>} */
  const games = new Set()
  /** @type {Set<string>} */
  const wanted = new Set()

  const cacheKey = (appid, type) => `${appid}\0${type}`

  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (normalized.startsWith('INSERT INTO API_CACHE')) {
        return {
          run(appid, type, data_json, cached_at) {
            cache.set(cacheKey(appid, type), {
              appid: String(appid),
              type: String(type),
              data_json: String(data_json),
              cached_at: Number(cached_at)
            })
          }
        }
      }

      if (normalized.startsWith('SELECT DATA_JSON, CACHED_AT FROM API_CACHE')) {
        return {
          get(appid, type) {
            const row = cache.get(cacheKey(appid, type))
            return row
              ? { data_json: row.data_json, cached_at: row.cached_at }
              : undefined
          }
        }
      }

      if (normalized === 'DELETE FROM API_CACHE WHERE TYPE = ?') {
        return {
          run(type) {
            let changes = 0
            for (const [key, row] of [...cache.entries()]) {
              if (row.type === String(type)) {
                cache.delete(key)
                changes += 1
              }
            }
            return { changes }
          }
        }
      }

      if (normalized === 'DELETE FROM API_CACHE WHERE TYPE LIKE ?') {
        return {
          run(pattern) {
            const prefix = String(pattern).replace(/%$/, '')
            let changes = 0
            for (const [key, row] of [...cache.entries()]) {
              if (row.type.startsWith(prefix)) {
                cache.delete(key)
                changes += 1
              }
            }
            return { changes }
          }
        }
      }

      if (normalized === 'SELECT APPID FROM GAMES') {
        return {
          all() {
            return [...games].map((appid) => ({ appid }))
          }
        }
      }

      if (normalized === 'SELECT APPID FROM WANTED_GAMES') {
        return {
          all() {
            return [...wanted].map((appid) => ({ appid }))
          }
        }
      }

      if (normalized.startsWith('INSERT INTO GAMES')) {
        return {
          run(appid) {
            games.add(String(appid))
          }
        }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    },
    /** @param {string} appid */
    _addGame(appid) {
      games.add(String(appid))
    },
    /** @param {string} appid */
    _addWanted(appid) {
      wanted.add(String(appid))
    }
  }
}

test('pruneObsoleteAppData removes ephemeral api_cache types and keeps durable', () => {
  const db = openMockDb()
  db._addGame('570')

  setCacheEntry(db, '570', 'schema', '{"ok":1}')
  setCacheEntry(db, '570', 'appdetails', '{"name":"x"}')
  setCacheEntry(db, '570', 'hunter_metacritic', '{"metacritic":90}')
  setCacheEntry(db, '570', 'percentages', '{"a":1}')
  setCacheEntry(db, '570', 'appdetails_stats_v2', '{}')
  setCacheEntry(db, '__steam_news__', 'popularwishlist_v3', '[]')
  setCacheEntry(db, '__steam_news__', 'news:570', '[]')

  const imagesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-img-'))
  fs.mkdirSync(path.join(imagesRoot, '570'))
  fs.mkdirSync(path.join(imagesRoot, '999'))

  const result = pruneObsoleteAppData(db, imagesRoot)

  assert.ok(result.apiCacheRowsDeleted >= 4)
  assert.ok(getCacheEntry(db, '570', 'schema'))
  assert.ok(getCacheEntry(db, '570', 'appdetails'))
  assert.ok(getCacheEntry(db, '570', 'hunter_metacritic'))
  assert.equal(getCacheEntry(db, '570', 'percentages'), undefined)
  assert.equal(getCacheEntry(db, '570', 'appdetails_stats_v2'), undefined)
  assert.equal(getCacheEntry(db, '__steam_news__', 'news:570'), undefined)

  assert.deepEqual(listImageAppidDirs(imagesRoot).sort(), ['570'])
  assert.equal(result.orphanImageDirsRemoved, 1)
  assert.deepEqual(getAllGameAppids(db), ['570'])

  fs.rmSync(imagesRoot, { recursive: true, force: true })
})

test('pruneObsoleteAppData preserves image directories for wanted games', () => {
  const db = openMockDb()
  db._addGame('570')
  db._addWanted('1297900')

  const imagesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-img-'))
  fs.mkdirSync(path.join(imagesRoot, '570'))
  fs.mkdirSync(path.join(imagesRoot, '1297900'))
  fs.mkdirSync(path.join(imagesRoot, '999999'))

  const result = pruneObsoleteAppData(db, imagesRoot)

  assert.equal(result.orphanImageDirsRemoved, 1)
  assert.deepEqual(listImageAppidDirs(imagesRoot).sort(), ['1297900', '570'])

  fs.rmSync(imagesRoot, { recursive: true, force: true })
})
