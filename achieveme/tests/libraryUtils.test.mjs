import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { filterAndSortGames } = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/libraryUtils.ts')).href
)

const sampleGames = [
  {
    appid: '1',
    name: 'Alpha Game',
    cover_url: '',
    total_achievements: 10,
    unlocked_achievements: 8,
    completion_pct: 80,
    has_platinum: false,
    last_unlocked_at: 100
  },
  {
    appid: '2',
    name: 'Beta Quest',
    cover_url: '',
    total_achievements: 10,
    unlocked_achievements: 3,
    completion_pct: 30,
    has_platinum: false,
    last_unlocked_at: 500
  },
  {
    appid: '3',
    name: 'Gamma',
    cover_url: '',
    total_achievements: 10,
    unlocked_achievements: 5,
    completion_pct: 50,
    has_platinum: false,
    last_unlocked_at: 200
  }
]

test('unlocked-desc orders by unlocked_achievements descending', () => {
  const result = filterAndSortGames(sampleGames, '', 'unlocked-desc')
  assert.deepEqual(result.map((g) => g.appid), ['1', '3', '2'])
})

test('completion-asc orders by completion_pct ascending', () => {
  const result = filterAndSortGames(sampleGames, '', 'completion-asc')
  assert.deepEqual(result.map((g) => g.appid), ['2', '3', '1'])
})

test('recent orders by last_unlocked_at descending', () => {
  const result = filterAndSortGames(sampleGames, '', 'recent')
  assert.deepEqual(result.map((g) => g.appid), ['2', '3', '1'])
})

test('search filter is case-insensitive', () => {
  const result = filterAndSortGames(sampleGames, 'beta', 'unlocked-desc')
  assert.equal(result.length, 1)
  assert.equal(result[0].appid, '2')
})
