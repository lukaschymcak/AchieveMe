import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  buildTransferDockRows,
  isTransfersDockVisible,
  shouldShowDepotInDock,
  shouldShowUpdateInDock
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/transfersDockUtils.ts')).href)

function makeDepot(overrides = {}) {
  return {
    channelId: 'download:1',
    appId: '570',
    gameName: 'Dota 2',
    phase: 'downloading',
    gameData: null,
    selectedDepots: [],
    outputPath: 'C:\\Games\\Dota',
    logs: [],
    pct: 42,
    speedBps: null,
    etaSec: null,
    status: 'Downloading',
    ...overrides
  }
}

function makeUpdate(overrides = {}) {
  return {
    appid: '570',
    mode: 'update',
    busy: true,
    pct: 12,
    label: 'Updating…',
    error: '',
    gameName: 'Dota 2',
    phase: 'running',
    ...overrides
  }
}

test('buildTransferDockRows returns empty when nothing active', () => {
  assert.deepEqual(buildTransferDockRows({}), [])
  assert.equal(isTransfersDockVisible([]), false)
})

test('buildTransferDockRows includes downloading depot only', () => {
  const rows = buildTransferDockRows({ depot: makeDepot() })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'depot')
  assert.equal(rows[0].openTarget, 'depot')
  assert.equal(rows[0].pct, 42)
  assert.equal(isTransfersDockVisible(rows), true)
})

test('buildTransferDockRows includes busy update only', () => {
  const rows = buildTransferDockRows({ update: makeUpdate() })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'update')
  assert.equal(rows[0].openTarget, 'update')
  assert.equal(isTransfersDockVisible(rows), true)
})

test('buildTransferDockRows includes both depot and update', () => {
  const rows = buildTransferDockRows({
    depot: makeDepot(),
    update: makeUpdate()
  })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'depot')
  assert.equal(rows[1].kind, 'update')
})

test('completed update with done phase and not busy is excluded', () => {
  assert.equal(
    shouldShowUpdateInDock(
      makeUpdate({ busy: false, phase: 'done', label: '', error: '' })
    ),
    false
  )
  assert.deepEqual(
    buildTransferDockRows({
      update: makeUpdate({ busy: false, phase: 'done' })
    }),
    []
  )
})

test('update reapply and error phases stay in dock when not busy', () => {
  assert.equal(
    shouldShowUpdateInDock(makeUpdate({ busy: false, phase: 'reapply_ask' })),
    true
  )
  assert.equal(
    shouldShowUpdateInDock(makeUpdate({ busy: false, phase: 'error', error: 'fail' })),
    true
  )
})

test('pick_depots update phase is excluded until busy', () => {
  assert.equal(
    shouldShowUpdateInDock(makeUpdate({ busy: false, phase: 'pick_depots' })),
    false
  )
})

test('search depot phase stays out of the dock', () => {
  assert.equal(shouldShowDepotInDock(makeDepot({ phase: 'search' })), false)
})

test('depot post-download Goldberg phases stay in the dock', () => {
  for (const phase of ['prompt', 'dll', 'emu', 'apply', 'complete']) {
    assert.equal(
      shouldShowDepotInDock(makeDepot({ phase, pct: 100, status: 'Download complete' })),
      true,
      phase
    )
  }
})

test('buildTransferDockRows keeps depot after download completes', () => {
  const rows = buildTransferDockRows({
    depot: makeDepot({ phase: 'prompt', pct: 100, status: 'Download complete' })
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'depot')
  assert.equal(rows[0].pct, 100)
  assert.equal(isTransfersDockVisible(rows), true)
})

test('buildTransferDockRows hides depot row when depot modal is open', () => {
  const rows = buildTransferDockRows({
    depot: makeDepot(),
    update: makeUpdate(),
    depotModalOpen: true
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'update')
})

test('buildTransferDockRows hides update row when update modal is open', () => {
  const rows = buildTransferDockRows({
    depot: makeDepot(),
    update: makeUpdate(),
    updateModalOpen: true
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'depot')
})

test('buildTransferDockRows hides both rows when both modals are open', () => {
  const rows = buildTransferDockRows({
    depot: makeDepot(),
    update: makeUpdate(),
    depotModalOpen: true,
    updateModalOpen: true
  })
  assert.deepEqual(rows, [])
  assert.equal(isTransfersDockVisible(rows), false)
})
