import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseLudusaviApiJson,
  extractFindTitle,
  extractBackupGameResult,
  formatBackupRelativeTime
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/ludusaviApiUtils.ts')).href)

test('parseLudusaviApiJson returns null for blank or invalid', () => {
  assert.equal(parseLudusaviApiJson(''), null)
  assert.equal(parseLudusaviApiJson('   '), null)
  assert.equal(parseLudusaviApiJson('not-json'), null)
})

test('parseLudusaviApiJson parses backup --api fixture', () => {
  const raw = JSON.stringify({
    errors: { someGamesFailed: true },
    overall: {
      totalGames: 2,
      totalBytes: 150,
      processedGames: 1,
      processedBytes: 100
    },
    games: {
      'Game 1': {
        decision: 'Processed',
        files: { '/games/game1/save.json': { bytes: 100 } },
        registry: {}
      },
      'Game 2': {
        decision: 'Ignored',
        files: { '/games/game2/save.json': { bytes: 50 } },
        registry: {}
      }
    }
  })
  const parsed = parseLudusaviApiJson(raw)
  assert.ok(parsed && typeof parsed === 'object')
  assert.ok('games' in parsed)
})

test('extractFindTitle returns first game key', () => {
  assert.equal(
    extractFindTitle({
      games: { 'The Blood of Dawnwalker': { score: 1 } }
    }),
    'The Blood of Dawnwalker'
  )
  assert.equal(extractFindTitle({ games: {} }), null)
  assert.equal(extractFindTitle(null), null)
  assert.equal(extractFindTitle({ games: null }), null)
})

test('extractBackupGameResult ok for Processed', () => {
  const api = {
    games: {
      Dota: {
        decision: 'Processed',
        files: {
          a: { bytes: 40, failed: false },
          b: { bytes: 60, failed: false }
        },
        registry: {}
      }
    }
  }
  const result = extractBackupGameResult(api, 'Dota')
  assert.equal(result.ok, true)
  assert.equal(result.decision, 'Processed')
  assert.equal(result.bytes, 100)
  assert.equal(result.error, undefined)
})

test('extractBackupGameResult fails for missing title', () => {
  const result = extractBackupGameResult({ games: {} }, 'Missing')
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /not found|missing/i)
})

test('extractBackupGameResult fails when decision Ignored and someGamesFailed', () => {
  const api = {
    errors: { someGamesFailed: true },
    games: {
      X: { decision: 'Ignored', files: {}, registry: {} }
    }
  }
  const result = extractBackupGameResult(api, 'X')
  assert.equal(result.ok, false)
  assert.equal(result.decision, 'Ignored')
})

test('extractBackupGameResult fails when file failed', () => {
  const api = {
    games: {
      Y: {
        decision: 'Processed',
        files: { a: { bytes: 10, failed: true, error: { message: 'access denied' } } },
        registry: {}
      }
    }
  }
  const result = extractBackupGameResult(api, 'Y')
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /access denied|failed/i)
})

test('formatBackupRelativeTime', () => {
  const now = 1_700_000_000
  assert.equal(formatBackupRelativeTime(0, now), '')
  assert.equal(formatBackupRelativeTime(now - 30, now), 'just now')
  assert.equal(formatBackupRelativeTime(now - 120, now), '2m ago')
  assert.equal(formatBackupRelativeTime(now - 3600, now), '1h ago')
  assert.equal(formatBackupRelativeTime(now - 86400 * 2, now), '2d ago')
})
