import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { upsertGame, getGame, saveGameToolApply } = await import(
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
 * Minimal better-sqlite3-shaped store for tool-flag tests.
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

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('saveGameToolApply sets steamless and goldberg flags and paths', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())

  saveGameToolApply(db, '570', {
    steamlessApplied: true,
    steamlessExe: 'C:\\Games\\game.exe',
    goldbergApplied: true,
    goldbergDllPath: 'C:\\Games\\steam_api64.dll'
  })

  const row = getGame(db, '570')
  assert.equal(row?.steamless_applied, 1)
  assert.equal(row?.goldberg_applied, 1)
  assert.equal(row?.steamless_exe, 'C:\\Games\\game.exe')
  assert.equal(row?.goldberg_dll_path, 'C:\\Games\\steam_api64.dll')
})

test('upsertGame preserves tool flags and paths on achievement-style upsert', () => {
  const db = openMockDb()
  upsertGame(db, makeGame())
  saveGameToolApply(db, '570', {
    steamlessApplied: true,
    steamlessExe: 'C:\\Games\\game.exe',
    goldbergApplied: true,
    goldbergDllPath: 'C:\\Games\\steam_api64.dll'
  })

  upsertGame(
    db,
    makeGame({
      name: 'Dota 2 Updated',
      total_achievements: 10,
      unlocked_achievements: 3,
      completion_pct: 30,
      steamless_applied: 0,
      goldberg_applied: 0,
      steamless_exe: '',
      goldberg_dll_path: ''
    })
  )

  const row = getGame(db, '570')
  assert.equal(row?.name, 'Dota 2 Updated')
  assert.equal(row?.steamless_applied, 1)
  assert.equal(row?.goldberg_applied, 1)
  assert.equal(row?.steamless_exe, 'C:\\Games\\game.exe')
  assert.equal(row?.goldberg_dll_path, 'C:\\Games\\steam_api64.dll')
})
