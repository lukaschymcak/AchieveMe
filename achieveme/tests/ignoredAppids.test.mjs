import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { ignoreAppid, unignoreAppid, isAppidIgnored, getIgnoredAppids } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

/**
 * Minimal better-sqlite3-shaped store for ignored_appids tests.
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb() {
  /** @type {Map<string, { appid: string, ignored_at: number }>} */
  const store = new Map()

  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (normalized.startsWith('INSERT INTO IGNORED_APPIDS')) {
        return {
          run(appid, ignoredAt) {
            store.set(String(appid), { appid: String(appid), ignored_at: Number(ignoredAt) })
          }
        }
      }

      if (normalized.startsWith('DELETE FROM IGNORED_APPIDS')) {
        return {
          run(appid) {
            store.delete(String(appid))
          }
        }
      }

      if (normalized.includes('SELECT 1 FROM IGNORED_APPIDS')) {
        return {
          get(appid) {
            return store.has(String(appid)) ? { ok: 1 } : undefined
          }
        }
      }

      if (normalized.startsWith('SELECT APPID FROM IGNORED_APPIDS')) {
        return {
          all() {
            return [...store.values()].map((row) => ({ appid: row.appid }))
          }
        }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('ignoreAppid then isAppidIgnored is true', () => {
  const db = openMockDb()
  ignoreAppid(db, '570')
  assert.equal(isAppidIgnored(db, '570'), true)
})

test('unignoreAppid then isAppidIgnored is false', () => {
  const db = openMockDb()
  ignoreAppid(db, '570')
  unignoreAppid(db, '570')
  assert.equal(isAppidIgnored(db, '570'), false)
})

test('ignoreAppid twice does not throw', () => {
  const db = openMockDb()
  ignoreAppid(db, '730')
  assert.doesNotThrow(() => ignoreAppid(db, '730'))
  assert.equal(isAppidIgnored(db, '730'), true)
})

test('ignoreAppid rejects empty and non-numeric AppIDs', () => {
  const db = openMockDb()
  assert.doesNotThrow(() => ignoreAppid(db, ''))
  assert.doesNotThrow(() => ignoreAppid(db, 'abc'))
  assert.equal(isAppidIgnored(db, ''), false)
  assert.equal(isAppidIgnored(db, 'abc'), false)
  assert.deepEqual(getIgnoredAppids(db), [])
})

test('getIgnoredAppids returns numeric AppIDs only', () => {
  const db = openMockDb()
  ignoreAppid(db, '570')
  ignoreAppid(db, 'not-a-number')
  ignoreAppid(db, '440')
  assert.deepEqual(getIgnoredAppids(db).sort(), ['440', '570'])
})
