import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { upsertGame, getGame, updateGameLaunchArgs, updateGameLaunchExe } = await import(
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
    launch_args: '',
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
 * Minimal better-sqlite3-shaped store for launch_args tests.
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
            store.set(appid, {
              ...existing,
              ...row,
              launch_exe:
                row.launch_exe && String(row.launch_exe) !== ''
                  ? row.launch_exe
                  : existing.launch_exe,
              launch_args:
                row.launch_args && String(row.launch_args) !== ''
                  ? row.launch_args
                  : existing.launch_args,
              backup_status: existing.backup_status,
              backup_at: existing.backup_at,
              backup_error: existing.backup_error,
              steamless_applied: existing.steamless_applied,
              goldberg_applied: existing.goldberg_applied,
              steamless_exe: existing.steamless_exe,
              goldberg_dll_path: existing.goldberg_dll_path
            })
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET')) {
        return {
          run(...args) {
            const appid = String(args[args.length - 1])
            const existing = store.get(appid)
            if (!existing) return
            const next = { ...existing }
            const setClause = String(sql)
              .replace(/^UPDATE\s+games\s+SET\s+/i, '')
              .replace(/\s+WHERE\s+appid\s*=\s*\?$/i, '')
            const cols = setClause.split(',').map((c) => c.trim().split(/\s*=\s*/)[0].trim())
            for (let i = 0; i < cols.length; i++) {
              next[cols[i]] = args[i]
            }
            store.set(appid, next)
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

test('updateGameLaunchArgs writes and clears args', () => {
  const db = openMockDb()
  upsertGame(db, makeGame({ launch_exe: 'C:\\Games\\game.exe' }))
  updateGameLaunchArgs(db, '570', '-windowed')
  assert.equal(getGame(db, '570')?.launch_args, '-windowed')
  updateGameLaunchArgs(db, '570', '')
  assert.equal(getGame(db, '570')?.launch_args, '')
})

test('upsertGame preserves launch_args when incoming is empty', () => {
  const db = openMockDb()
  upsertGame(db, makeGame({ launch_exe: 'C:\\Games\\game.exe', launch_args: '-windowed' }))
  updateGameLaunchExe(db, '570', 'C:\\Games\\game.exe')

  upsertGame(
    db,
    makeGame({
      name: 'Dota 2 Updated',
      launch_exe: '',
      launch_args: ''
    })
  )

  const row = getGame(db, '570')
  assert.equal(row?.name, 'Dota 2 Updated')
  assert.equal(row?.launch_exe, 'C:\\Games\\game.exe')
  assert.equal(row?.launch_args, '-windowed')
})
