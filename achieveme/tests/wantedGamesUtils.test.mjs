import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  normalizeWantedAppid,
  wantedAddRejection,
  sortWantedNewestFirst,
  wantedStoreUrl
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/wantedGamesUtils.ts')).href)

test('normalizeWantedAppid keeps digits and rejects junk', () => {
  assert.equal(normalizeWantedAppid('570'), '570')
  assert.equal(normalizeWantedAppid(' 730 '), '730')
  assert.equal(normalizeWantedAppid(''), null)
  assert.equal(normalizeWantedAppid('abc'), null)
  assert.equal(normalizeWantedAppid('57.0'), null)
})

test('wantedAddRejection blocks invalid and in-library AppIDs', () => {
  const library = new Set(['570'])
  assert.equal(wantedAddRejection({ appid: 'abc', libraryAppids: library }), 'invalid-appid')
  assert.equal(wantedAddRejection({ appid: '570', libraryAppids: library }), 'in-library')
  assert.equal(wantedAddRejection({ appid: '440', libraryAppids: library }), null)
})

test('sortWantedNewestFirst orders by addedAt desc then appid', () => {
  const sorted = sortWantedNewestFirst([
    { appid: '2', addedAt: 10 },
    { appid: '1', addedAt: 30 },
    { appid: '3', addedAt: 30 }
  ])
  assert.deepEqual(
    sorted.map((g) => g.appid),
    ['1', '3', '2']
  )
})

test('wantedStoreUrl builds the Steam store path', () => {
  assert.equal(wantedStoreUrl('570'), 'https://store.steampowered.com/app/570')
})
