import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { achievementDescription } = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/achievementDescription.ts')).href
)

test('hidden unearned with description hides when showDescriptions is false', () => {
  assert.equal(
    achievementDescription('Defeat the secret boss', 1, 0, false),
    null
  )
})

test('hidden unearned with description shows when showDescriptions is true', () => {
  assert.equal(
    achievementDescription('Defeat the secret boss', 1, 0, true),
    'Defeat the secret boss'
  )
})

test('hidden unearned without description shows placeholder when showDescriptions is true', () => {
  assert.equal(achievementDescription('', 1, 0, true), 'Hidden achievement')
  assert.equal(achievementDescription('   ', 1, 0, true), 'Hidden achievement')
})

test('hidden unearned without description hides when showDescriptions is false', () => {
  assert.equal(achievementDescription('', 1, 0, false), null)
})

test('earned hidden with description always shows description', () => {
  assert.equal(
    achievementDescription('You found it', 1, 1, false),
    'You found it'
  )
  assert.equal(
    achievementDescription('You found it', 1, 1, true),
    'You found it'
  )
})

test('non-hidden achievement shows description regardless of showDescriptions', () => {
  assert.equal(
    achievementDescription('Win a match', 0, 0, false),
    'Win a match'
  )
  assert.equal(
    achievementDescription('Win a match', 0, 0, true),
    'Win a match'
  )
})

test('non-hidden without description returns null', () => {
  assert.equal(achievementDescription('', 0, 0, false), null)
})
