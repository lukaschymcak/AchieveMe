import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { scanInstalledGames } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/installedGamesScanService.ts')).href
)
const { shouldRetainWithoutSaves } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/libraryRetentionUtils.ts')).href
)
const { upsertScannedInstall, getGame } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

/**
 * Minimal games + ignored mock for upsertScannedInstall.
 * @returns {import('better-sqlite3').Database}
 */
function openMockDb() {
  /** @type {Map<string, object>} */
  const games = new Map()
  /** @type {Set<string>} */
  const ignored = new Set()

  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (normalized.startsWith('SELECT') && normalized.includes('FROM GAMES WHERE APPID')) {
        return {
          get(appid) {
            return games.get(String(appid))
          }
        }
      }

      if (normalized.startsWith('INSERT INTO GAMES') && normalized.includes('INSTALL_PATH')) {
        return {
          run(appid, name, installPath, launchExe) {
            games.set(String(appid), {
              appid: String(appid),
              name,
              install_path: installPath,
              launch_exe: launchExe || '',
              manifest_gids: '',
              total_achievements: 0,
              unlocked_achievements: 0,
              completion_pct: 0,
              has_platinum: 0,
              last_unlocked_at: 0,
              schema_fetched_at: 0,
              playtime_seconds: 0,
              launch_args: '',
              playtime_session_started_at: 0,
              playtime_last_flush_at: 0,
              update_status: 'unknown',
              backup_status: '',
              backup_at: 0,
              backup_error: '',
              ludusavi_title: '',
              steamless_applied: 0,
              goldberg_applied: 0,
              steamless_exe: '',
              goldberg_dll_path: ''
            })
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET INSTALL_PATH')) {
        return {
          run(installPath, appid) {
            const row = games.get(String(appid))
            if (row) row.install_path = installPath
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET LAUNCH_EXE')) {
        return {
          run(launchExe, appid) {
            const row = games.get(String(appid))
            if (row) row.launch_exe = launchExe
          }
        }
      }

      if (normalized.startsWith('UPDATE GAMES SET NAME')) {
        return {
          run(name, appid) {
            const row = games.get(String(appid))
            if (row) row.name = name
          }
        }
      }

      if (normalized.startsWith('DELETE FROM IGNORED_APPIDS')) {
        return {
          run(appid) {
            ignored.delete(String(appid))
          }
        }
      }

      if (normalized.includes('SELECT 1 FROM IGNORED_APPIDS')) {
        return {
          get(appid) {
            return ignored.has(String(appid)) ? { ok: 1 } : undefined
          }
        }
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`)
    }
  }
}

test('scanInstalledGames finds steam_appid.txt installs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-scan-'))
  try {
    const gameDir = path.join(tmp, 'EldenRing')
    fs.mkdirSync(gameDir, { recursive: true })
    fs.writeFileSync(path.join(gameDir, 'steam_appid.txt'), '1245620\n')
    fs.writeFileSync(path.join(gameDir, 'Game.exe'), 'x')

    const found = scanInstalledGames([tmp], {
      listExes: () => [
        {
          name: 'Game.exe',
          relativePath: 'Game.exe',
          absolutePath: path.join(gameDir, 'Game.exe'),
          suggested: true
        }
      ]
    })

    assert.equal(found.length, 1)
    assert.equal(found[0].appid, '1245620')
    assert.equal(found[0].installPath, gameDir)
    assert.equal(found[0].suggestedExe, path.join(gameDir, 'Game.exe'))
    assert.equal(found[0].alreadyInLibrary, false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('scanInstalledGames finds numeric folder with steam_api dll', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-scan-num-'))
  try {
    const gameDir = path.join(tmp, '570')
    fs.mkdirSync(gameDir, { recursive: true })
    fs.writeFileSync(path.join(gameDir, 'steam_api64.dll'), 'x')

    const found = scanInstalledGames([tmp], { listExes: () => [] })
    assert.equal(found.length, 1)
    assert.equal(found[0].appid, '570')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('scanInstalledGames refuses drive-root style roots and skips ignored by default', () => {
  const found = scanInstalledGames(['C:\\'], {
    listExes: () => []
  })
  assert.equal(found.length, 0)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-scan-ign-'))
  try {
    const gameDir = path.join(tmp, 'Foo')
    fs.mkdirSync(gameDir, { recursive: true })
    fs.writeFileSync(path.join(gameDir, 'steam_appid.txt'), '999\n')

    const hidden = scanInstalledGames([tmp], {
      listExes: () => [],
      isIgnored: (id) => id === '999'
    })
    assert.equal(hidden.length, 0)

    const shown = scanInstalledGames([tmp], {
      listExes: () => [],
      includeIgnored: true,
      isIgnored: (id) => id === '999'
    })
    assert.equal(shown.length, 1)
    assert.equal(shown[0].ignored, true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('scanInstalledGames marks alreadyInLibrary and dedupes appids', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-scan-lib-'))
  try {
    const a = path.join(tmp, 'A')
    const b = path.join(tmp, 'B')
    fs.mkdirSync(a, { recursive: true })
    fs.mkdirSync(b, { recursive: true })
    fs.writeFileSync(path.join(a, 'steam_appid.txt'), '570\n')
    fs.writeFileSync(path.join(b, 'steam_appid.txt'), '570\n')

    const found = scanInstalledGames([tmp], {
      listExes: () => [],
      getGameByAppid: (id) => (id === '570' ? { name: 'Dota 2', install_path: 'X' } : undefined)
    })
    assert.equal(found.length, 1)
    assert.equal(found[0].alreadyInLibrary, true)
    assert.equal(found[0].guessedName, 'Dota 2')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('upsertScannedInstall creates retainable row without achievements', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-upsert-'))
  try {
    const gameDir = path.join(tmp, 'Game')
    fs.mkdirSync(gameDir, { recursive: true })
    const db = openMockDb()
    const result = upsertScannedInstall(db, {
      appid: '570',
      gameName: 'Dota 2',
      installPath: gameDir,
      launchExe: path.join(gameDir, 'dota2.exe')
    })
    assert.equal(result.created, true)
    const row = getGame(db, '570')
    assert.ok(row)
    assert.equal(row.install_path, gameDir)
    assert.equal(row.launch_exe, path.join(gameDir, 'dota2.exe'))
    assert.equal(shouldRetainWithoutSaves(row), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('upsertScannedInstall updates path and keeps existing launch_exe', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-upsert2-'))
  try {
    const oldDir = path.join(tmp, 'old')
    const newDir = path.join(tmp, 'new')
    fs.mkdirSync(oldDir, { recursive: true })
    fs.mkdirSync(newDir, { recursive: true })
    const db = openMockDb()
    upsertScannedInstall(db, {
      appid: '570',
      gameName: 'Dota 2',
      installPath: oldDir,
      launchExe: path.join(oldDir, 'a.exe')
    })
    const second = upsertScannedInstall(db, {
      appid: '570',
      gameName: 'Dota 2',
      installPath: newDir,
      launchExe: path.join(newDir, 'b.exe')
    })
    assert.equal(second.created, false)
    const row = getGame(db, '570')
    assert.equal(row.install_path, newDir)
    assert.equal(row.launch_exe, path.join(oldDir, 'a.exe'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
