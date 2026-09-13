import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  upsertGame,
  getGame,
  updateGamePlaytimeSession,
  getGamesWithOpenPlaytimeSession,
  updateGamePlaytime
} = await import(pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href)

function makeGame(overrides = {}) {
  return {
    appid: '570',
    name: 'Dota 2',
    total_achievements: 1,
    unlocked_achievements: 0,
    completion_pct: 0,
    has_platinum: 0,
    last_unlocked_at: 0,
    schema_fetched_at: 0,
    playtime_seconds: 0,
    install_path: '',
    launch_exe: '',
    playtime_session_started_at: 0,
    playtime_last_flush_at: 0,
    manifest_gids: '',
    update_status: '',
    backup_status: '',
    backup_at: 0,
    backup_error: '',
    ludusavi_title: '',
    steamless_applied: 0,
    goldberg_applied: 0,
    steamless_exe: '',
    goldberg_dll_path: '',
    ...overrides
  }
}

/**
 * Minimal better-sqlite3-shaped store for playtime session tests.
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb() {
  /** @type {Map<string, object>} */
  const store = new Map()

  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (
        normalized.startsWith('SELECT') &&
        normalized.includes('FROM GAMES WHERE PLAYTIME_SESSION_STARTED_AT > 0')
      ) {
        return {
          all() {
            return [...store.values()]
              .filter((row) => Number(row.playtime_session_started_at ?? 0) > 0)
              .sort((a, b) => String(a.appid).localeCompare(String(b.appid)))
          }
        }
      }

      if (normalized.startsWith('SELECT') && normalized.includes('FROM GAMES WHERE APPID')) {
        return {
          get(appid) {
            return store.get(String(appid))
          }
        }
      }

      if (normalized.startsWith('INSERT INTO GAMES')) {
        return {
          run(row) {
            const appid = String(row.appid)
            const existing = store.get(appid)
            if (!existing) {
              store.set(appid, {
                ...row,
                playtime_session_started_at: row.playtime_session_started_at ?? 0,
                playtime_last_flush_at: row.playtime_last_flush_at ?? 0
              })
              return
            }
            // Upsert must not overwrite session columns (omitted from SQL UPDATE).
            store.set(appid, {
              ...existing,
              ...row,
              playtime_session_started_at: existing.playtime_session_started_at ?? 0,
              playtime_last_flush_at: existing.playtime_last_flush_at ?? 0,
              backup_status: existing.backup_status,
              backup_at: existing.backup_at,
              backup_error: existing.backup_error,
              steamless_applied: existing.steamless_applied,
              goldberg_applied: existing.goldberg_applied,
              steamless_exe: existing.steamless_exe,
              goldberg_dll_path: existing.goldberg_dll_path,
              playtime_seconds:
                Number(row.playtime_seconds) > Number(existing.playtime_seconds)
                  ? row.playtime_seconds
                  : existing.playtime_seconds
            })
          }
        }
      }

      if (
        normalized.startsWith('UPDATE GAMES SET PLAYTIME_SESSION_STARTED_AT') &&
        normalized.includes('PLAYTIME_LAST_FLUSH_AT')
      ) {
        return {
          run(startedAt, lastFlushAt, appid) {
            const existing = store.get(String(appid))
            if (!existing) return
            store.set(String(appid), {
              ...existing,
              playtime_session_started_at: startedAt,
              playtime_last_flush_at: lastFlushAt
            })
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET PLAYTIME_SECONDS')) {
        return {
          run(seconds, appid) {
            const existing = store.get(String(appid))
            if (!existing) return
            store.set(String(appid), { ...existing, playtime_seconds: seconds })
          }
        }
      }

      if (normalized.startsWith('DELETE FROM WANTED_GAMES')) {
        return { run() {} }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('updateGamePlaytimeSession writes and clears session columns', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  updateGamePlaytimeSession(db, '570', { startedAt: 1_000, lastFlushAt: 1_500 })
  let row = getGame(db, '570')
  assert.equal(row.playtime_session_started_at, 1_000)
  assert.equal(row.playtime_last_flush_at, 1_500)

  updateGamePlaytimeSession(db, '570', { startedAt: 0, lastFlushAt: 0 })
  row = getGame(db, '570')
  assert.equal(row.playtime_session_started_at, 0)
  assert.equal(row.playtime_last_flush_at, 0)
})

test('upsertGame preserves playtime session columns', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  updateGamePlaytimeSession(db, '570', { startedAt: 9_000, lastFlushAt: 9_100 })
  updateGamePlaytime(db, '570', 120)

  upsertGame(
    db,
    makeGame({
      unlocked_achievements: 1,
      completion_pct: 100,
      playtime_seconds: 0,
      playtime_session_started_at: 0,
      playtime_last_flush_at: 0
    })
  )

  const row = getGame(db, '570')
  assert.equal(row.playtime_session_started_at, 9_000)
  assert.equal(row.playtime_last_flush_at, 9_100)
  assert.equal(row.playtime_seconds, 120)
  assert.equal(row.unlocked_achievements, 1)
})

test('getGamesWithOpenPlaytimeSession returns only open sessions', () => {
  const db = openMockDb()
  upsertGame(db, makeGame({ appid: '1' }))
  upsertGame(db, makeGame({ appid: '2' }))
  updateGamePlaytimeSession(db, '2', { startedAt: 50, lastFlushAt: 60 })

  const open = getGamesWithOpenPlaytimeSession(db)
  assert.equal(open.length, 1)
  assert.equal(open[0].appid, '2')
})
