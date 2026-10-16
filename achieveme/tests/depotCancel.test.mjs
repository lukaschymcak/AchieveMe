import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { depotCancelEpoch, isDepotCancelStale, requestDepotCancel, resetDepotCancelEpochsForTests } =
  await import(pathToFileURL(path.join(rootDir, '../src/shared/depotCancel.ts')).href)

test('requestDepotCancel invalidates the epoch captured when a job started', () => {
  resetDepotCancelEpochsForTests()
  const channelId = 'depot:570:validate'
  const epochAtStart = depotCancelEpoch(channelId)
  assert.equal(isDepotCancelStale(channelId, epochAtStart), false)
  requestDepotCancel(channelId)
  assert.equal(isDepotCancelStale(channelId, epochAtStart), true)
})

test('a new job snapshots the epoch after cancel and is not stale', () => {
  resetDepotCancelEpochsForTests()
  const channelId = 'depot:570:validate'
  requestDepotCancel(channelId)
  const epochAtStart = depotCancelEpoch(channelId)
  assert.equal(isDepotCancelStale(channelId, epochAtStart), false)
})
