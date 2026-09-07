import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { upsertGame, getGame, updateGameBackupStatus } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

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
 * Minimal better-sqlite3-shaped store for games backup status tests.
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb() {
  /** @type {Map<string, object>} */
  const store = new Map()

  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

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
              store.set(appid, { ...row })
              return
            }
            // Mirror ON CONFLICT preserve for backup_* columns
            store.set(appid, {
              ...existing,
              ...row,
              backup_status: existing.backup_status,
              backup_at: existing.backup_at,
              backup_error: existing.backup_error,
              steamless_applied: existing.steamless_applied,
              goldberg_applied: existing.goldberg_applied,
              steamless_exe: existing.steamless_exe,
              goldberg_dll_path: existing.goldberg_dll_path,
              ludusavi_title:
                row.ludusavi_title && String(row.ludusavi_title) !== ''
                  ? row.ludusavi_title
                  : existing.ludusavi_title
            })
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET BACKUP_STATUS')) {
        return {
          run(status, at, error, ludusaviTitle, appid) {
            const existing = store.get(String(appid))
            if (!existing) return
            store.set(String(appid), {
              ...existing,
              backup_status: status,
              backup_at: at,
              backup_error: error,
              ludusavi_title: ludusaviTitle
            })
          }
        }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('updateGameBackupStatus writes status fields', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  updateGameBackupStatus(db, '570', {
    status: 'ok',
    at: 1_700_000_000,
    error: '',
    ludusaviTitle: 'Dota 2'
  })
  const row = getGame(db, '570')
  assert.equal(row.backup_status, 'ok')
  assert.equal(row.backup_at, 1_700_000_000)
  assert.equal(row.backup_error, '')
  assert.equal(row.ludusavi_title, 'Dota 2')
})

test('upsertGame preserves backup status on achievement-style upsert', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  updateGameBackupStatus(db, '570', {
    status: 'ok',
    at: 100,
    error: '',
    ludusaviTitle: 'Dota 2'
  })
  upsertGame(
    db,
    makeGame({
      unlocked_achievements: 1,
      completion_pct: 100,
      backup_status: '',
      backup_at: 0,
      backup_error: '',
      ludusavi_title: ''
    })
  )
  const row = getGame(db, '570')
  assert.equal(row.unlocked_achievements, 1)
  assert.equal(row.backup_status, 'ok')
  assert.equal(row.backup_at, 100)
  assert.equal(row.ludusavi_title, 'Dota 2')
})

test('updateGameBackupStatus sets missing and error', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  updateGameBackupStatus(db, '570', {
    status: 'missing',
    at: 50,
    error: 'Not in Ludusavi'
  })
  const row = getGame(db, '570')
  assert.equal(row.backup_status, 'missing')
  assert.equal(row.backup_error, 'Not in Ludusavi')
})
