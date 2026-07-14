import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  computeLevelProgress,
  computeLibraryCompletionPct,
  pickNearCompletionGames,
  pickRecentUnlocks,
  normalizeProfileStats
} = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/profileStatsUtils.ts')).href
)

test('computeLevelProgress maps XP into level band', () => {
  assert.deepEqual(computeLevelProgress(0), {
    level: 0,
    xpInLevel: 0,
    xpToNext: 1000,
    levelPct: 0
  })
  assert.deepEqual(computeLevelProgress(1250), {
    level: 1,
    xpInLevel: 250,
    xpToNext: 750,
    levelPct: 25
  })
})

test('computeLibraryCompletionPct averages trackable games only', () => {
  const pct = computeLibraryCompletionPct([
    {
      appid: '1',
      name: 'A',
      total_achievements: 10,
      unlocked_achievements: 5,
      completion_pct: 50,
      has_platinum: 0,
      last_unlocked_at: 0,
      schema_fetched_at: 0
    },
    {
      appid: '2',
      name: 'B',
      total_achievements: 0,
      unlocked_achievements: 0,
      completion_pct: 0,
      has_platinum: 0,
      last_unlocked_at: 0,
      schema_fetched_at: 0
    },
    {
      appid: '3',
      name: 'C',
      total_achievements: 10,
      unlocked_achievements: 10,
      completion_pct: 100,
      has_platinum: 1,
      last_unlocked_at: 0,
      schema_fetched_at: 0
    }
  ])

  assert.equal(pct, 75)
})

test('pickRecentUnlocks returns newest earned achievements with game names', () => {
  const gameNames = new Map([
    ['1', 'Alpha'],
    ['2', 'Beta']
  ])

  const recent = pickRecentUnlocks(
    [
      {
        appid: '1',
        api_name: 'OLD',
        display_name: 'Old Trophy',
        description: '',
        icon_url: '',
        icon_gray_url: '',
        global_percent: 50,
        earned: 1,
        earned_time: 100,
        trophy_tier: 'bronze',
        hidden: 0
      },
      {
        appid: '2',
        api_name: 'NEW',
        display_name: 'Fresh Trophy',
        description: '',
        icon_url: '',
        icon_gray_url: '',
        global_percent: 10,
        earned: 1,
        earned_time: 500,
        trophy_tier: 'gold',
        hidden: 0
      }
    ],
    gameNames,
    1
  )

  assert.equal(recent.length, 1)
  assert.equal(recent[0].gameName, 'Beta')
  assert.equal(recent[0].achievementName, 'Fresh Trophy')
  assert.equal(recent[0].tier, 'gold')
})

test('pickNearCompletionGames keeps 50-99% games sorted by completion', () => {
  const near = pickNearCompletionGames(
    [
      {
        appid: '1',
        name: 'Almost',
        total_achievements: 10,
        unlocked_achievements: 9,
        completion_pct: 92,
        has_platinum: 0,
        last_unlocked_at: 0,
        schema_fetched_at: 0
      },
      {
        appid: '2',
        name: 'Done',
        total_achievements: 10,
        unlocked_achievements: 10,
        completion_pct: 100,
        has_platinum: 1,
        last_unlocked_at: 0,
        schema_fetched_at: 0
      },
      {
        appid: '3',
        name: 'Mid',
        total_achievements: 10,
        unlocked_achievements: 6,
        completion_pct: 60,
        has_platinum: 0,
        last_unlocked_at: 0,
        schema_fetched_at: 0
      }
    ],
    2
  )

  assert.deepEqual(
    near.map((game) => game.appid),
    ['1', '3']
  )
})

test('normalizeProfileStats fills legacy profile_stats.json fields', () => {
  const normalized = normalizeProfileStats({
    totalGames: 2,
    totalUnlocked: 4,
    platinum: 0,
    gold: 1,
    silver: 1,
    bronze: 2,
    level: 0,
    xp: 250,
    monthlyActivity: [{ month: '2026-01', count: 2 }]
  })

  assert.equal(normalized.libraryCompletionPct, 0)
  assert.deepEqual(normalized.recentUnlocks, [])
  assert.deepEqual(normalized.nearCompletionGames, [])
})
