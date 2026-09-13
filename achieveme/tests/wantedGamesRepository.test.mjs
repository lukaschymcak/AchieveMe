import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { listWantedGames, addWantedGame, removeWantedGame, isWantedGame } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

/**
 * Minimal better-sqlite3-shaped store for wanted_games + games lookup tests.
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb(libraryAppids = new Set()) {
  /** @type {Map<string, { appid: string, name: string, cover_url: string, added_at: number }>} */
  const wanted = new Map()
  /** @type {Set<string>} */
  const library = new Set(libraryAppids)

  return {
    _setWantedAddedAt(appid, addedAt) {
      const row = wanted.get(String(appid))
      if (row) row.added_at = Number(addedAt)
    },
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (normalized.startsWith('SELECT APPID, NAME, COVER_URL, ADDED_AT FROM WANTED_GAMES ORDER')) {
        return {
          all() {
            return [...wanted.values()].sort((a, b) => {
              if (b.added_at !== a.added_at) return b.added_at - a.added_at
              return a.appid.localeCompare(b.appid)
            })
          }
        }
      }

      if (
        normalized.startsWith(
          'SELECT APPID, NAME, COVER_URL, ADDED_AT FROM WANTED_GAMES WHERE APPID'
        )
      ) {
        return {
          get(appid) {
            return wanted.get(String(appid))
          }
        }
      }

      if (normalized.startsWith('INSERT INTO WANTED_GAMES')) {
        return {
          run(appid, name, coverUrl, addedAt) {
            wanted.set(String(appid), {
              appid: String(appid),
              name: String(name),
              cover_url: String(coverUrl),
              added_at: Number(addedAt)
            })
          }
        }
      }

      if (normalized.startsWith('DELETE FROM WANTED_GAMES')) {
        return {
          run(appid) {
            wanted.delete(String(appid))
          }
        }
      }

      if (normalized.includes('SELECT 1 FROM WANTED_GAMES WHERE APPID')) {
        return {
          get(appid) {
            return wanted.has(String(appid)) ? { 1: 1 } : undefined
          }
        }
      }

      // getGame SELECT … FROM games WHERE appid = ?
      if (normalized.includes('FROM GAMES WHERE APPID')) {
        return {
          get(appid) {
            return library.has(String(appid))
              ? { appid: String(appid), name: 'In Library' }
              : undefined
          }
        }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('addWantedGame then listWantedGames returns newest first', () => {
  const db = openMockDb()
  const first = addWantedGame(db, { appid: '1', name: 'Older', coverUrl: '' })
  assert.equal(first.ok, true)
  // Force older timestamp — same-second inserts would otherwise tie-break by appid ASC
  db._setWantedAddedAt('1', 1000)
  const second = addWantedGame(db, { appid: '2', name: 'Newer', coverUrl: 'https://x' })
  assert.equal(second.ok, true)
  db._setWantedAddedAt('2', 2000)
  const listed = listWantedGames(db)
  assert.equal(listed.length, 2)
  assert.equal(listed[0].appid, '2')
  assert.equal(listed[1].appid, '1')
  // Repo returns stored cover_url; IPC remaps to achieveme-img:// via getStoreCoverUrl
  assert.equal(listed[0].coverUrl, 'https://x')
  assert.equal(listed[1].coverUrl, '')
})

test('addWantedGame rejects in-library AppIDs', () => {
  const db = openMockDb(new Set(['570']))
  const result = addWantedGame(db, { appid: '570', name: 'Dota' })
  assert.deepEqual(result, { ok: false, reason: 'in-library' })
  assert.deepEqual(listWantedGames(db), [])
})

test('addWantedGame rejects invalid AppIDs', () => {
  const db = openMockDb()
  const result = addWantedGame(db, { appid: 'abc', name: 'Nope' })
  assert.deepEqual(result, { ok: false, reason: 'invalid-appid' })
})

test('addWantedGame is idempotent', () => {
  const db = openMockDb()
  const a = addWantedGame(db, { appid: '440', name: 'TF2' })
  const b = addWantedGame(db, { appid: '440', name: 'Team Fortress 2' })
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.equal(a.created, true)
    assert.equal(b.created, false)
    assert.equal(b.game.name, 'TF2')
  }
  assert.equal(listWantedGames(db).length, 1)
})

test('removeWantedGame clears the pin', () => {
  const db = openMockDb()
  addWantedGame(db, { appid: '730', name: 'CS' })
  assert.equal(isWantedGame(db, '730'), true)
  removeWantedGame(db, '730')
  assert.equal(isWantedGame(db, '730'), false)
  assert.deepEqual(listWantedGames(db), [])
})

test('removeWantedGame graduates like upsert would', () => {
  const db = openMockDb()
  addWantedGame(db, { appid: '570', name: 'Dota' })
  assert.equal(isWantedGame(db, '570'), true)
  removeWantedGame(db, '570')
  assert.equal(isWantedGame(db, '570'), false)
})
