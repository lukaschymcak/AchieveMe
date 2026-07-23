import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  SESSION_RECAP_MIN_SECONDS,
  shouldOfferSessionRecap,
  unlocksInSessionWindow,
  xpForSessionUnlocks,
  pickRandomGameIndex,
  pickDemoSessionSeconds,
  pickDemoUnlocks
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/sessionRecapUtils.ts')).href)

function ach(partial) {
  return {
    appid: '1',
    api_name: 'a',
    display_name: 'A',
    description: '',
    icon_url: '',
    icon_gray_url: '',
    global_percent: 50,
    earned: 1,
    earned_time: 100,
    trophy_tier: 'bronze',
    hidden: 0,
    progress: 0,
    max_progress: 0,
    ...partial
  }
}

describe('sessionRecapUtils', () => {
  it('gates recap on minimum session length', () => {
    assert.equal(SESSION_RECAP_MIN_SECONDS, 60)
    assert.equal(shouldOfferSessionRecap(59), false)
    assert.equal(shouldOfferSessionRecap(60), true)
  })

  it('filters unlocks to the session time window', () => {
    const list = [
      ach({ api_name: 'before', earned_time: 50 }),
      ach({ api_name: 'in', display_name: 'In', earned_time: 100, trophy_tier: 'silver' }),
      ach({ api_name: 'after', earned_time: 200 }),
      ach({ api_name: 'locked', earned: 0, earned_time: 0 })
    ]
    const unlocks = unlocksInSessionWindow(list, 90, 150)
    assert.equal(unlocks.length, 1)
    assert.equal(unlocks[0].apiName, 'in')
    assert.equal(unlocks[0].tier, 'silver')
  })

  it('sums XP from unlock tiers', () => {
    assert.equal(
      xpForSessionUnlocks([
        { apiName: 'a', displayName: 'A', iconUrl: '', tier: 'bronze' },
        { apiName: 'b', displayName: 'B', iconUrl: '', tier: 'gold' }
      ]),
      250
    )
  })

  it('picks random game index and demo duration', () => {
    assert.equal(pickRandomGameIndex(0), -1)
    assert.equal(pickRandomGameIndex(3, () => 0), 0)
    assert.equal(pickRandomGameIndex(3, () => 0.99), 2)
    const secs = pickDemoSessionSeconds(() => 0)
    assert.equal(secs, 12 * 60)
  })

  it('picks up to three earned achievements for demo', () => {
    const demo = pickDemoUnlocks(
      [
        ach({ api_name: '1', earned_time: 300 }),
        ach({ api_name: '2', earned_time: 200 }),
        ach({ api_name: '3', earned_time: 100 }),
        ach({ api_name: '4', earned_time: 50 }),
        ach({ api_name: 'x', earned: 0, earned_time: 0 })
      ],
      3
    )
    assert.deepEqual(
      demo.map((u) => u.apiName),
      ['1', '2', '3']
    )
  })
})
