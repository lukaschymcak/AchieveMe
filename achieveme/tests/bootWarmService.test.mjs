import assert from 'node:assert/strict'
import test from 'node:test'
import {
  rawFromPersistedAchievements,
  runBootWarmCore
} from '../src/shared/bootWarmUtils.ts'

test('rawFromPersistedAchievements maps earned flags', () => {
  const raw = rawFromPersistedAchievements([
    {
      api_name: 'ACH_1',
      earned: 1,
      earned_time: 100,
      progress: 0,
      max_progress: 0
    },
    {
      api_name: 'ACH_2',
      earned: 0,
      earned_time: 0,
      progress: 2,
      max_progress: 5
    }
  ])
  assert.deepEqual(raw.ACH_1, {
    achieved: true,
    unlockTime: 100,
    progress: 0,
    maxProgress: 0
  })
  assert.deepEqual(raw.ACH_2, {
    achieved: false,
    unlockTime: 0,
    progress: 2,
    maxProgress: 5
  })
})

test('runBootWarmCore phase order and concurrency-safe progress', async () => {
  const phases = []
  const warmed = []
  let inFlight = 0
  let maxInFlight = 0

  const result = await runBootWarmCore(undefined, {
    prune: () => {},
    listAppids: () => ['1', '2', '3', '4', 'bad', '1'],
    getApiKey: () => 'key',
    concurrency: 2,
    warmGame: async (appid) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      warmed.push(appid)
      inFlight -= 1
    },
    warmNews: async () => {},
    regenerateProfile: () => {}
  })

  // Progress listener via second run to assert phases
  const phaseLog = []
  await runBootWarmCore(
    (p) => {
      phaseLog.push(p.phase)
    },
    {
      prune: () => {},
      listAppids: () => [],
      getApiKey: () => '',
      warmGame: async () => {},
      warmNews: async () => {},
      regenerateProfile: () => {}
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.gamesWarmed, 4)
  assert.equal(result.gamesFailed, 0)
  assert.deepEqual(warmed.sort(), ['1', '2', '3', '4'])
  assert.equal(maxInFlight, 2)
  assert.ok(phaseLog.includes('prune'))
  assert.ok(phaseLog.includes('library'))
  assert.ok(phaseLog.includes('news'))
  assert.equal(phaseLog[phaseLog.length - 1], 'done')
})

test('runBootWarmCore fail-soft on per-game errors', async () => {
  const result = await runBootWarmCore(undefined, {
    prune: () => {},
    listAppids: () => ['570', '730'],
    getApiKey: () => '',
    concurrency: 3,
    warmGame: async (appid) => {
      if (appid === '570') throw new Error('boom')
    },
    warmNews: async () => {
      throw new Error('news down')
    },
    regenerateProfile: () => {}
  })

  assert.equal(result.ok, true)
  assert.equal(result.gamesWarmed, 1)
  assert.equal(result.gamesFailed, 1)
})

test('runBootWarmCore coalesces progress labels for games', async () => {
  /** @type {string[]} */
  const labels = []
  await runBootWarmCore(
    (p) => {
      labels.push(p.label)
    },
    {
      prune: () => {},
      listAppids: () => ['10', '20'],
      getApiKey: () => '',
      concurrency: 1,
      warmGame: async () => {},
      warmNews: async () => {},
      regenerateProfile: () => {}
    }
  )
  assert.ok(labels.some((l) => l === 'Updating rarities…'))
  assert.ok(labels.some((l) => /Warming games \(2\/2\)/.test(l)))
  assert.ok(labels.includes('Ready'))
})
