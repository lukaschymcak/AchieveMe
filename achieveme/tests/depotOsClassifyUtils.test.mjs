import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bucketDepotsForScan,
  classifyDepotDescription,
  classifyDepotForScan,
  depotScanChipLabel
} from '../src/shared/depotOsClassifyUtils.ts'

test('classifyDepotDescription drops linux/mac/osx', () => {
  assert.equal(classifyDepotDescription('Game Content (Linux)'), 'drop')
  assert.equal(classifyDepotDescription('Game macOS'), 'drop')
  assert.equal(classifyDepotDescription('Content OSX'), 'drop')
  assert.equal(classifyDepotDescription('Mac Client'), 'drop')
})

test('classifyDepotDescription auto-keeps windows and dlc', () => {
  assert.equal(classifyDepotDescription('Game Content (Windows)'), 'auto-keep')
  assert.equal(classifyDepotDescription('Season Pass DLC'), 'auto-keep')
})

test('classifyDepotDescription unsure when no OS/DLC signal', () => {
  assert.equal(classifyDepotDescription('Game Content'), 'unsure')
  assert.equal(classifyDepotDescription('Content Depot'), 'unsure')
})

test('classifyDepotDescription does not treat Machine as Mac', () => {
  assert.equal(classifyDepotDescription('Pinball Machine Pack'), 'unsure')
})

test('classifyDepotForScan auto-keeps when depot id is in dlcs set', () => {
  assert.equal(
    classifyDepotForScan('999001', 'Extra Content', new Set(['999001'])),
    'auto-keep'
  )
})

test('bucketDepotsForScan ignores depots without manifest GIDs', () => {
  const buckets = bucketDepotsForScan(
    {
      '1': { description: 'Windows' },
      '2': { description: 'Linux' },
      '3': { description: 'Mystery' },
      '4': { description: 'Windows no gid' }
    },
    { '1': 'gid-w', '2': 'gid-l', '3': 'gid-u' },
    {}
  )
  assert.deepEqual(buckets.autoKeepIds.sort(), ['1'])
  assert.deepEqual(buckets.dropIds.sort(), ['2'])
  assert.deepEqual(buckets.unsureIds.sort(), ['3'])
})

test('depotScanChipLabel returns Windows DLC Unsure or null', () => {
  assert.equal(depotScanChipLabel('1', 'Content (Windows)', new Set()), 'Windows')
  assert.equal(depotScanChipLabel('2', 'Season Pass DLC', new Set()), 'DLC')
  assert.equal(depotScanChipLabel('3', 'Extra Content', new Set(['3'])), 'DLC')
  assert.equal(depotScanChipLabel('4', 'Mystery Pack', new Set()), 'Unsure')
  assert.equal(depotScanChipLabel('5', 'Linux Client', new Set()), null)
})
