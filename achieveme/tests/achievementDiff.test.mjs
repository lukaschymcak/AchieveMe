import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { diffAchievements } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/achievementDiff.ts')).href
)

function ach(overrides) {
  return {
    appid: '570',
    api_name: 'ACH_ONE',
    display_name: 'First Blood',
    description: '',
    icon_url: '',
    icon_gray_url: '',
    global_percent: 50,
    earned: 0,
    earned_time: 0,
    trophy_tier: 'bronze',
    hidden: 0,
    progress: 0,
    max_progress: 0,
    ...overrides
  }
}

test('diffAchievements reports newly earned achievements', () => {
  const previous = [ach({ api_name: 'A' }), ach({ api_name: 'B', earned: 1, earned_time: 100 })]
  const next = [
    ach({ api_name: 'A', earned: 1, earned_time: 200 }),
    ach({ api_name: 'B', earned: 1, earned_time: 100 })
  ]

  const result = diffAchievements(previous, next)
  assert.equal(result.unlocked.length, 1)
  assert.equal(result.unlocked[0].apiName, 'A')
  assert.equal(result.unlocked[0].earnedTime, 200)
})

test('diffAchievements ignores already earned achievements', () => {
  const row = ach({ earned: 1, earned_time: 50 })
  const result = diffAchievements([row], [{ ...row }])
  assert.deepEqual(result.unlocked, [])
})

test('diffAchievements reports progress increases for unearned achievements', () => {
  const previous = [ach({ progress: 2, max_progress: 10 })]
  const next = [ach({ progress: 5, max_progress: 10 })]
  const result = diffAchievements(previous, next)

  assert.equal(result.progressUpdated.length, 1)
  assert.equal(result.progressUpdated[0].progress, 5)
  assert.equal(result.progressUpdated[0].maxProgress, 10)
})

test('diffAchievements ignores progress when max_progress is zero', () => {
  const previous = [ach({ progress: 0, max_progress: 0 })]
  const next = [ach({ progress: 3, max_progress: 0 })]
  assert.deepEqual(diffAchievements(previous, next).progressUpdated, [])
})

test('diffAchievements ignores progress on earned achievements', () => {
  const previous = [ach({ earned: 1, progress: 10, max_progress: 10 })]
  const next = [ach({ earned: 1, progress: 10, max_progress: 10 })]
  assert.deepEqual(diffAchievements(previous, next).progressUpdated, [])
})
