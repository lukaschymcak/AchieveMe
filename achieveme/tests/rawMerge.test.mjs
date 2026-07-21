import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { mergeRawAchievements } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/rawMerge.ts')).href
)

test('mergeRawAchievements keeps max progress across sources', () => {
  const merged = mergeRawAchievements([
    {
      source: 'codex',
      raw: {
        ACH_A: { achieved: false, unlockTime: 0, progress: 2, maxProgress: 10 }
      }
    },
    {
      source: 'goldberg',
      raw: {
        ACH_A: { achieved: false, unlockTime: 0, progress: 7, maxProgress: 10 }
      }
    }
  ])

  assert.equal(merged.ACH_A.progress, 7)
  assert.equal(merged.ACH_A.maxProgress, 10)
})

test('mergeRawAchievements still merges earned state and unlock time', () => {
  const merged = mergeRawAchievements([
    {
      source: 'rune',
      raw: {
        ACH_B: { achieved: true, unlockTime: 100 }
      }
    },
    {
      source: 'goldberg',
      raw: {
        ACH_B: { achieved: false, unlockTime: 0, progress: 1, maxProgress: 5 }
      }
    }
  ])

  assert.equal(merged.ACH_B.achieved, true)
  assert.equal(merged.ACH_B.unlockTime, 100)
})
