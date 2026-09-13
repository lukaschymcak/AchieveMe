import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOOT_STAGES,
  getBootPhaseIndex,
  computeBootProgressPct,
  formatBootStatus
} from '../src/shared/bootSplashUtils.ts'

test('BOOT_STAGES contains four sequential boot milestones', () => {
  assert.equal(BOOT_STAGES.length, 4)
  assert.deepEqual(
    BOOT_STAGES.map((s) => s.id),
    ['prune', 'library', 'games', 'news']
  )
})

test('getBootPhaseIndex maps known phases to correct stage numbers', () => {
  assert.equal(getBootPhaseIndex('prune'), 0)
  assert.equal(getBootPhaseIndex('library'), 1)
  assert.equal(getBootPhaseIndex('games'), 2)
  assert.equal(getBootPhaseIndex('news'), 3)
  assert.equal(getBootPhaseIndex('done'), 4)
  assert.equal(getBootPhaseIndex('error'), -1)
  assert.equal(getBootPhaseIndex(null), 0)
  assert.equal(getBootPhaseIndex(undefined), 0)
})

test('computeBootProgressPct handles edge cases, zero totals, and clamping', () => {
  assert.equal(computeBootProgressPct(0, 0), 0)
  assert.equal(computeBootProgressPct(5, 0), 0)
  assert.equal(computeBootProgressPct(-1, 10), 0)
  assert.equal(computeBootProgressPct(1, 4), 25)
  assert.equal(computeBootProgressPct(1, 3), 33)
  assert.equal(computeBootProgressPct(2, 3), 67)
  assert.equal(computeBootProgressPct(10, 10), 100)
  assert.equal(computeBootProgressPct(15, 10), 100)
  assert.equal(computeBootProgressPct(NaN, 10), 0)
  assert.equal(computeBootProgressPct(5, NaN), 0)
})

test('formatBootStatus provides stage metadata and determinate state', () => {
  const prune = formatBootStatus('prune', 'Pruning old data…')
  assert.equal(prune.stageTitle, 'CACHE AUDIT')
  assert.equal(prune.detailLabel, 'Pruning old data…')
  assert.equal(prune.isDeterminate, false)
  assert.equal(prune.percent, null)

  const games = formatBootStatus('games', 'Warming games (4/10)…', 4, 10)
  assert.equal(games.stageTitle, 'METADATA & RARITY SYNC')
  assert.equal(games.detailLabel, 'Warming games (4/10)…')
  assert.equal(games.isDeterminate, true)
  assert.equal(games.percent, 40)
  assert.equal(games.showCount, true)

  const empty = formatBootStatus(null, null)
  assert.equal(empty.stageTitle, 'INITIALIZING')
  assert.equal(empty.detailLabel, 'Preparing showcase…')
  assert.equal(empty.isDeterminate, false)
})
