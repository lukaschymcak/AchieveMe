import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeWarmAppids,
  runWithConcurrency,
  BOOT_WARM_CONCURRENCY,
  PRUNE_API_CACHE_TYPES,
  DURABLE_API_CACHE_TYPES
} from '../src/shared/bootWarmUtils.ts'

test('normalizeWarmAppids drops non-numeric and dedupes', () => {
  assert.deepEqual(normalizeWarmAppids(['570', 'Game', '570', ' 730 ', '']), [
    '570',
    '730'
  ])
})

test('runWithConcurrency never exceeds limit', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const items = Array.from({ length: 10 }, (_, i) => i)

  await runWithConcurrency(items, 3, async () => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight -= 1
  })

  assert.equal(maxInFlight, 3)
  assert.equal(BOOT_WARM_CONCURRENCY, 3)
})

test('runWithConcurrency handles empty list', async () => {
  let called = 0
  await runWithConcurrency([], 3, async () => {
    called += 1
  })
  assert.equal(called, 0)
})

test('prune type lists keep durable types out of prune set', () => {
  for (const durable of DURABLE_API_CACHE_TYPES) {
    assert.equal(
      PRUNE_API_CACHE_TYPES.includes(durable),
      false,
      `${durable} must not be pruned`
    )
  }
  assert.ok(PRUNE_API_CACHE_TYPES.includes('percentages'))
  assert.ok(PRUNE_API_CACHE_TYPES.includes('appdetails_stats_v2'))
})
