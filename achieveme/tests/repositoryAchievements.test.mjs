import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { replaceAchievementsForGame, getAchievementsForGame, upsertAchievements } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/db/repository.ts')).href
)

function makeAchievement(appid, apiName, displayName = apiName) {
  return {
    appid,
    api_name: apiName,
    display_name: displayName,
    description: '',
    icon_url: '',
    icon_gray_url: '',
    global_percent: 0,
    earned: 0,
    earned_time: 0,
    trophy_tier: 'bronze',
    hidden: 0,
    progress: 0,
    max_progress: 0
  }
}

/**
 * Minimal better-sqlite3-shaped store for achievement repository tests.
 * Avoids the Electron-native better-sqlite3 binary under system Node.
 */
function openMockDb() {
  /** @type {Map<string, object>} */
  const store = new Map()

  const db = {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase()

      if (normalized.startsWith('DELETE FROM ACHIEVEMENTS')) {
        return {
          run(appid) {
            for (const key of [...store.keys()]) {
              if (key.startsWith(`${appid}\0`)) store.delete(key)
            }
          }
        }
      }

      if (normalized.startsWith('SELECT * FROM ACHIEVEMENTS')) {
        return {
          all(appid) {
            return [...store.values()]
              .filter((row) => row.appid === appid)
              .sort((a, b) => {
                if (b.earned !== a.earned) return b.earned - a.earned
                return String(a.display_name).localeCompare(String(b.display_name))
              })
          }
        }
      }

      // INSERT ... ON CONFLICT upsert
      return {
        run(row) {
          const key = `${row.appid}\0${row.api_name}`
          store.set(key, { ...row })
        }
      }
    },
    transaction(fn) {
      return (arg) => fn(arg)
    }
  }

  return db
}

test('replaceAchievementsForGame prunes orphan SteamAchievements row', () => {
  const db = openMockDb()
  upsertAchievements(db, [makeAchievement('123', 'SteamAchievements')])
  assert.equal(getAchievementsForGame(db, '123').length, 1)

  replaceAchievementsForGame(db, '123', [])
  assert.deepEqual(getAchievementsForGame(db, '123'), [])
})

test('replaceAchievementsForGame keeps only the new Steam catalog rows', () => {
  const db = openMockDb()
  upsertAchievements(db, [
    makeAchievement('123', 'SteamAchievements'),
    makeAchievement('123', 'OLD_ACH')
  ])

  replaceAchievementsForGame(db, '123', [
    makeAchievement('123', 'ACH_A', 'Alpha'),
    makeAchievement('123', 'ACH_B', 'Beta')
  ])

  const rows = getAchievementsForGame(db, '123')
  assert.deepEqual(rows.map((r) => r.api_name).sort(), ['ACH_A', 'ACH_B'])
  assert.ok(!rows.some((r) => r.api_name === 'SteamAchievements'))
})

test('replaceAchievementsForGame does not touch other appids', () => {
  const db = openMockDb()
  upsertAchievements(db, [
    makeAchievement('111', 'KEEP_ME'),
    makeAchievement('222', 'SteamAchievements')
  ])

  replaceAchievementsForGame(db, '222', [])

  assert.equal(getAchievementsForGame(db, '111').length, 1)
  assert.equal(getAchievementsForGame(db, '111')[0].api_name, 'KEEP_ME')
  assert.deepEqual(getAchievementsForGame(db, '222'), [])
})
