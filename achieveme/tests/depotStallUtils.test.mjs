import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { isDepotStalled, applyDepotValidateArg, DEPOT_STALL_MS } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/depotStallUtils.ts')).href
)

test('isDepotStalled is false while output or bytes are still recent', () => {
  assert.equal(isDepotStalled(10_000, 10_000), false)
  assert.equal(isDepotStalled(DEPOT_STALL_MS - 1, 0), false)
})

test('isDepotStalled is true after two minutes without activity', () => {
  assert.equal(isDepotStalled(DEPOT_STALL_MS, 0), true)
  assert.equal(isDepotStalled(200_000, 80_000), true)
})

test('applyDepotValidateArg adds checksum validation only when asked', () => {
  const base = ['-app', '1', '-dir', 'D:\\Games']
  assert.deepEqual(applyDepotValidateArg(base, false), base)
  assert.deepEqual(applyDepotValidateArg([...base, '-validate'], false), base)
  assert.deepEqual(applyDepotValidateArg(base, true), [...base, '-validate'])
})
