import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { nextUpdatePhaseAfterSuccess, updateDepotChannelId, updatePhaseKeepsDock } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/updateTransferUtils.ts')).href
)

test('nextUpdatePhaseAfterSuccess returns reapply_ask when steamless applied', () => {
  assert.equal(
    nextUpdatePhaseAfterSuccess({ steamlessApplied: true, goldbergApplied: false }),
    'reapply_ask'
  )
})

test('nextUpdatePhaseAfterSuccess returns reapply_ask when goldberg applied', () => {
  assert.equal(
    nextUpdatePhaseAfterSuccess({ steamlessApplied: false, goldbergApplied: true }),
    'reapply_ask'
  )
})

test('nextUpdatePhaseAfterSuccess returns done when neither flag set', () => {
  assert.equal(
    nextUpdatePhaseAfterSuccess({ steamlessApplied: false, goldbergApplied: false }),
    'done'
  )
})

test('updatePhaseKeepsDock keeps error and reapply phases', () => {
  assert.equal(updatePhaseKeepsDock('error'), true)
  assert.equal(updatePhaseKeepsDock('reapply_ask'), true)
  assert.equal(updatePhaseKeepsDock('reapply_pick'), true)
  assert.equal(updatePhaseKeepsDock('reapply_run'), true)
  assert.equal(updatePhaseKeepsDock('running'), true)
})

test('updateDepotChannelId matches the depot runner channel', () => {
  assert.equal(updateDepotChannelId('570', 'validate'), 'depot:570:validate')
  assert.equal(updateDepotChannelId(' 730 ', 'update'), 'depot:730:update')
})

test('updatePhaseKeepsDock excludes pick_depots and done', () => {
  assert.equal(updatePhaseKeepsDock('pick_depots'), false)
  assert.equal(updatePhaseKeepsDock('done'), false)
  assert.equal(updatePhaseKeepsDock(undefined), false)
})
