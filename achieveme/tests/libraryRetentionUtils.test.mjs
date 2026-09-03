import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  hasStoredManifestGids,
  shouldRetainWithoutSaves,
  isIgnoredAppid,
  planProcessAppId,
  shouldPruneLibraryGame
} = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/libraryRetentionUtils.ts')).href
)

test('hasStoredManifestGids is true only for non-empty depot maps', () => {
  assert.equal(hasStoredManifestGids(''), false)
  assert.equal(hasStoredManifestGids('{}'), false)
  assert.equal(hasStoredManifestGids('{"123":"gid-a"}'), true)
})

test('shouldRetainWithoutSaves when GIDs or install_path present', () => {
  assert.equal(shouldRetainWithoutSaves(undefined), false)
  assert.equal(shouldRetainWithoutSaves({ manifest_gids: '', install_path: '' }), false)
  assert.equal(
    shouldRetainWithoutSaves({ manifest_gids: '{"1":"g"}', install_path: '' }),
    true
  )
  assert.equal(
    shouldRetainWithoutSaves({ manifest_gids: '', install_path: 'D:\\Games\\Foo' }),
    true
  )
})

test('isIgnoredAppid checks set membership', () => {
  const ignored = new Set(['570', '730'])
  assert.equal(isIgnoredAppid(ignored, '570'), true)
  assert.equal(isIgnoredAppid(ignored, '440'), false)
})

test('planProcessAppId: ignored AppID + saves on disk → skip-ignored', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(['570']),
      discoveredCount: 2,
      existing: { manifest_gids: '', install_path: '' }
    }),
    'skip-ignored'
  )
})

test('planProcessAppId: no saves, no existing row → delete-orphan', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(),
      discoveredCount: 0
    }),
    'delete-orphan'
  )
})

test('planProcessAppId: no saves, GIDs present → retain-without-saves', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(),
      discoveredCount: 0,
      existing: { manifest_gids: '{"571":"gid"}', install_path: '' }
    }),
    'retain-without-saves'
  )
})

test('planProcessAppId: no saves, install_path only → retain-without-saves', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(),
      discoveredCount: 0,
      existing: { manifest_gids: '{}', install_path: 'D:\\Games\\Dota' }
    }),
    'retain-without-saves'
  )
})

test('planProcessAppId: no saves, empty GIDs and empty path → delete-orphan', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(),
      discoveredCount: 0,
      existing: { manifest_gids: '{}', install_path: '' }
    }),
    'delete-orphan'
  )
})

test('planProcessAppId: saves present, not ignored → upsert-from-saves', () => {
  assert.equal(
    planProcessAppId({
      appid: '570',
      ignoredAppids: new Set(),
      discoveredCount: 1,
      existing: { manifest_gids: '', install_path: '' }
    }),
    'upsert-from-saves'
  )
})

test('planProcessAppId: skip-ignored wins over discoveredCount > 0', () => {
  assert.equal(
    planProcessAppId({
      appid: '999',
      ignoredAppids: new Set(['999']),
      discoveredCount: 5,
      existing: { manifest_gids: '{"1":"g"}', install_path: 'C:\\x' }
    }),
    'skip-ignored'
  )
})

test('shouldPruneLibraryGame respects retain and onDisk', () => {
  assert.equal(
    shouldPruneLibraryGame({ manifest_gids: '{"1":"g"}', install_path: '' }, false),
    false
  )
  assert.equal(
    shouldPruneLibraryGame({ manifest_gids: '', install_path: 'D:\\Games' }, false),
    false
  )
  assert.equal(
    shouldPruneLibraryGame({ manifest_gids: '', install_path: '' }, false),
    true
  )
  assert.equal(
    shouldPruneLibraryGame({ manifest_gids: '', install_path: '' }, true),
    false
  )
})
