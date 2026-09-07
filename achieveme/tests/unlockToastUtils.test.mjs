import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const utils = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/unlockToastUtils.ts')).href
)

const {
  TOAST_PREVIEW_SAMPLES,
  TOAST_PREVIEW_TIERS,
  isNewPlatinum,
  nextToastPreviewIndex,
  toastPreviewDisplayName,
  toastPreviewSampleAt,
  toastPreviewTierAt,
  toastXpForTier,
  formatToastXp
} = utils

describe('unlockToastUtils', () => {
  it('cycles preview tiers bronze → silver → gold → platinum', () => {
    assert.deepEqual([...TOAST_PREVIEW_TIERS], ['bronze', 'silver', 'gold', 'platinum'])
    assert.equal(toastPreviewTierAt(0), 'bronze')
    assert.equal(toastPreviewTierAt(1), 'silver')
    assert.equal(toastPreviewTierAt(2), 'gold')
    assert.equal(toastPreviewTierAt(3), 'platinum')
    assert.equal(toastPreviewTierAt(4), 'bronze')
  })

  it('cycles short, medium, and long description preview samples', () => {
    assert.equal(TOAST_PREVIEW_SAMPLES.length, 4)
    assert.equal(toastPreviewSampleAt(0).description, 'Nice.')
    assert.ok(toastPreviewSampleAt(1).description.length > 40)
    assert.ok(toastPreviewSampleAt(1).description.length < 120)
    assert.ok(toastPreviewSampleAt(2).description.length > 120)
    assert.equal(toastPreviewSampleAt(3).tier, 'platinum')
    assert.equal(toastPreviewSampleAt(3).description, '')
    assert.equal(nextToastPreviewIndex(3), 0)
    assert.equal(toastPreviewSampleAt(0).displayName, 'Quick Win')
    assert.equal(toastPreviewSampleAt(1).displayName, 'Steady Progress')
    assert.equal(toastPreviewSampleAt(2).displayName, 'Marathon Runner')
  })

  it('uses platinum display name for celebration toast', () => {
    assert.equal(toastPreviewDisplayName('platinum'), 'All achievements unlocked')
  })

  it('maps toast tiers to profile XP values', () => {
    assert.equal(toastXpForTier('bronze'), 50)
    assert.equal(toastXpForTier('silver'), 100)
    assert.equal(toastXpForTier('gold'), 200)
    assert.equal(toastXpForTier('platinum'), 500)
    assert.equal(formatToastXp('gold'), '+200')
  })

  it('detects new platinum only when a known game first hits 100%', () => {
    assert.equal(isNewPlatinum(true, 0, 1), true)
    assert.equal(isNewPlatinum(true, 1, 1), false)
    assert.equal(isNewPlatinum(false, 0, 1), false)
    assert.equal(isNewPlatinum(true, 0, 0), false)
  })
})
