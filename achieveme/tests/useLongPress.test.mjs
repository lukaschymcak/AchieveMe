import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  computeHoldDurationMs,
  shouldFireLongPress,
  shouldShowHoldVisuals
} = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/hooks/longPressUtils.ts')).href
)

const GRACE_MS = 120
const THRESHOLD_MS = 500

test('computeHoldDurationMs subtracts grace from threshold', () => {
  assert.equal(computeHoldDurationMs(THRESHOLD_MS, GRACE_MS), 380)
  assert.equal(computeHoldDurationMs(500, 500), 0)
})

test('shouldShowHoldVisuals is false before grace and after release', () => {
  assert.equal(shouldShowHoldVisuals(50, GRACE_MS, false), false)
  assert.equal(shouldShowHoldVisuals(119, GRACE_MS, false), false)
  assert.equal(shouldShowHoldVisuals(120, GRACE_MS, false), true)
  assert.equal(shouldShowHoldVisuals(300, GRACE_MS, false), true)
  assert.equal(shouldShowHoldVisuals(300, GRACE_MS, true), false)
})

test('shouldFireLongPress only after threshold while still pressed', () => {
  assert.equal(shouldFireLongPress(499, THRESHOLD_MS, false), false)
  assert.equal(shouldFireLongPress(500, THRESHOLD_MS, false), true)
  assert.equal(shouldFireLongPress(600, THRESHOLD_MS, false), true)
  assert.equal(shouldFireLongPress(500, THRESHOLD_MS, true), false)
})

test('quick click stays below hold visual and long-press thresholds', () => {
  const quickClickMs = 80
  assert.equal(shouldShowHoldVisuals(quickClickMs, GRACE_MS, true), false)
  assert.equal(shouldFireLongPress(quickClickMs, THRESHOLD_MS, true), false)
})

test('mid-hold release shows visuals but not long press', () => {
  const releaseMs = 300
  assert.equal(shouldShowHoldVisuals(releaseMs, GRACE_MS, false), true)
  assert.equal(shouldFireLongPress(releaseMs, THRESHOLD_MS, true), false)
})
