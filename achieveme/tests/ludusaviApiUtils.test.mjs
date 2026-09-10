import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseLudusaviApiJson,
  extractFindTitle,
  extractBackupGameResult,
  formatBackupRelativeTime,
  extractBackupSnapshots,
  extractGameBackupPath,
  sortSnapshotsNewestFirst,
  takeNewestSnapshots,
  isSafeLudusaviBackupId,
  isUnchangedLudusaviBackup,
  isChangedLudusaviBackup,
  isLudusaviUnchangedSnapshotNote,
  LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE
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
        change: 'Different',
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
  assert.equal(result.change, 'Different')
  assert.equal(result.bytes, 100)
  assert.equal(result.error, undefined)
})

test('extractBackupGameResult includes change Same', () => {
  const api = {
    games: {
      Dota: {
        decision: 'Processed',
        change: 'Same',
        files: { a: { bytes: 10, failed: false } },
        registry: {}
      }
    }
  }
  const result = extractBackupGameResult(api, 'Dota')
  assert.equal(result.ok, true)
  assert.equal(result.change, 'Same')
  assert.equal(isUnchangedLudusaviBackup(result), true)
  assert.equal(isUnchangedLudusaviBackup({ ok: true, change: 'Different' }), false)
  assert.equal(isUnchangedLudusaviBackup({ ok: false, change: 'Same' }), false)
  assert.equal(isChangedLudusaviBackup({ ok: true, change: 'Different' }), true)
  assert.equal(isChangedLudusaviBackup({ ok: true, change: 'New' }), true)
  assert.equal(isChangedLudusaviBackup({ ok: true, change: 'Same' }), false)
  assert.equal(isChangedLudusaviBackup({ ok: true }), false)
  assert.equal(isLudusaviUnchangedSnapshotNote(LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE), true)
  assert.equal(isLudusaviUnchangedSnapshotNote('real failure'), false)
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

test('isSafeLudusaviBackupId rejects empty and path-like ids', () => {
  assert.equal(isSafeLudusaviBackupId(''), false)
  assert.equal(isSafeLudusaviBackupId('../evil'), false)
  assert.equal(isSafeLudusaviBackupId('a\\b'), false)
  assert.equal(isSafeLudusaviBackupId('a/b'), false)
  assert.equal(isSafeLudusaviBackupId('2024-01-02T03-04-05'), true)
  // Ludusavi solo backup name when full retention is 1
  assert.equal(isSafeLudusaviBackupId('.'), true)
})

test('extractBackupSnapshots parses backups --api fixture', () => {
  const api = {
    games: {
      Dota: {
        backupPath: '/backups/Dota',
        backups: [
          { name: 'old', when: '2024-01-01T00:00:00Z', locked: false },
          { name: 'new', when: '2024-06-01T12:00:00Z', locked: false }
        ]
      }
    }
  }
  const rows = extractBackupSnapshots(api, 'Dota')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, 'old')
  assert.ok(rows[1].whenMs > rows[0].whenMs)
})

test('takeNewestSnapshots sorts and limits to 5', () => {
  const snaps = [
    { id: 'a', when: '2024-01-01T00:00:00Z', whenMs: Date.parse('2024-01-01T00:00:00Z') },
    { id: 'b', when: '2024-05-01T00:00:00Z', whenMs: Date.parse('2024-05-01T00:00:00Z') },
    { id: 'c', when: '2024-03-01T00:00:00Z', whenMs: Date.parse('2024-03-01T00:00:00Z') },
    { id: 'd', when: '2024-02-01T00:00:00Z', whenMs: Date.parse('2024-02-01T00:00:00Z') },
    { id: 'e', when: '2024-04-01T00:00:00Z', whenMs: Date.parse('2024-04-01T00:00:00Z') },
    { id: 'f', when: '2024-06-01T00:00:00Z', whenMs: Date.parse('2024-06-01T00:00:00Z') }
  ]
  const top = takeNewestSnapshots(snaps, 5)
  assert.deepEqual(
    top.map((s) => s.id),
    ['f', 'b', 'e', 'c', 'd']
  )
  assert.deepEqual(
    sortSnapshotsNewestFirst(snaps).map((s) => s.id)[0],
    'f'
  )
})

test('extractBackupSnapshots returns empty for missing title', () => {
  assert.deepEqual(extractBackupSnapshots({ games: {} }, 'Missing'), [])
})

test('extractGameBackupPath reads backups --api backupPath', () => {
  assert.equal(
    extractGameBackupPath(
      { games: { Dota: { backupPath: '/backups/Dota', backups: [] } } },
      'Dota'
    ),
    '/backups/Dota'
  )
  assert.equal(extractGameBackupPath({ games: {} }, 'Dota'), null)
})
