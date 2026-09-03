import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { planProcessAppId, shouldPruneLibraryGame } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/libraryRetentionUtils.ts')).href
)

test('processAppId plan: four core actions', () => {
  assert.equal(
    planProcessAppId({
      appid: '1',
      ignoredAppids: new Set(['1']),
      discoveredCount: 1
    }),
    'skip-ignored'
  )
  assert.equal(
    planProcessAppId({
      appid: '2',
      ignoredAppids: new Set(),
      discoveredCount: 0
    }),
    'delete-orphan'
  )
  assert.equal(
    planProcessAppId({
      appid: '3',
      ignoredAppids: new Set(),
      discoveredCount: 0,
      existing: { manifest_gids: '{"9":"g"}', install_path: '' }
    }),
    'retain-without-saves'
  )
  assert.equal(
    planProcessAppId({
      appid: '4',
      ignoredAppids: new Set(),
      discoveredCount: 2
    }),
    'upsert-from-saves'
  )
})

test('prune helper: retain GID or install_path when off disk', () => {
  assert.equal(shouldPruneLibraryGame({ manifest_gids: '{"1":"g"}', install_path: '' }, false), false)
  assert.equal(shouldPruneLibraryGame({ manifest_gids: '', install_path: 'D:\\g' }, false), false)
  assert.equal(shouldPruneLibraryGame({ manifest_gids: '', install_path: '' }, false), true)
  assert.equal(shouldPruneLibraryGame({ manifest_gids: '', install_path: '' }, true), false)
})
