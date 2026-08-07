import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseManifestGidsJson,
  pickManifestGids,
  resolvePreferredBuildId,
  resolveUpdateStatus
} from '../src/shared/manifestUpdateUtils.ts'

test('parseManifestGidsJson returns empty for invalid input', () => {
  assert.deepEqual(parseManifestGidsJson(''), {})
  assert.deepEqual(parseManifestGidsJson('not-json'), {})
  assert.deepEqual(parseManifestGidsJson('[]'), {})
  assert.deepEqual(parseManifestGidsJson('null'), {})
})

test('parseManifestGidsJson keeps string depot GIDs only', () => {
  assert.deepEqual(
    parseManifestGidsJson(JSON.stringify({ '123': 'gid-a', '456': 99, skip: '' })),
    { '123': 'gid-a' }
  )
})

test('pickManifestGids returns empty for empty selection', () => {
  assert.deepEqual(pickManifestGids({ '123': 'gid-a', '456': 'gid-b' }, []), {})
})

test('pickManifestGids keeps only selected depots with non-empty GIDs', () => {
  assert.deepEqual(
    pickManifestGids(
      { '123': 'gid-a', '456': 'gid-b', '789': '  ' },
      ['123', '789', '999']
    ),
    { '123': 'gid-a' }
  )
})

test('resolveUpdateStatus detects changed depot GIDs', () => {
  const status = resolveUpdateStatus(
    { '123': 'old', '456': 'same' },
    [
      { appId: '1', depotId: '123', manifestGid: 'new' },
      { appId: '1', depotId: '456', manifestGid: 'same' }
    ]
  )
  assert.equal(status, 'update_available')
})

test('resolveUpdateStatus returns up_to_date when matched depots match', () => {
  const status = resolveUpdateStatus(
    { '123': 'gid-a' },
    [{ appId: '1', depotId: '123', manifestGid: 'gid-a', buildId: '99' }]
  )
  assert.equal(status, 'up_to_date')
})

test('resolveUpdateStatus returns empty when no overlapping depots', () => {
  const status = resolveUpdateStatus(
    { '123': 'gid-a' },
    [{ appId: '1', depotId: '999', manifestGid: 'other' }]
  )
  assert.equal(status, '')
})

test('resolvePreferredBuildId picks first usable build id', () => {
  assert.equal(
    resolvePreferredBuildId([
      { appId: '1', depotId: '1', manifestGid: 'a', buildId: '0' },
      { appId: '1', depotId: '2', manifestGid: 'b', buildId: '15234567' }
    ]),
    '15234567'
  )
  assert.equal(resolvePreferredBuildId([]), undefined)
})
