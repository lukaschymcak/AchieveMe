import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { parseChangelogNotes, resolvePendingChangelog } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/changelogUtils.ts')).href
)

test('parseChangelogNotes parses conventional commit messages', () => {
  const notes = [
    'feat: add changelog popup after update',
    'fix(ui): resolve overlay z-index collision',
    'perf: speed up process watcher check',
    'refactor: streamline update state handlers',
    'docs: update AGENTS manual',
    'chore: bump version to 0.1.5'
  ].join('\n')

  const parsed = parseChangelogNotes(notes)
  assert.equal(parsed.length, 6)

  assert.equal(parsed[0].type, 'feat')
  assert.equal(parsed[0].tag, 'feat')
  assert.equal(parsed[0].text, 'add changelog popup after update')

  assert.equal(parsed[1].type, 'fix')
  assert.equal(parsed[1].tag, 'fix')
  assert.equal(parsed[1].scope, 'ui')
  assert.equal(parsed[1].text, 'resolve overlay z-index collision')

  assert.equal(parsed[2].type, 'perf')
  assert.equal(parsed[2].tag, 'perf')
  assert.equal(parsed[2].text, 'speed up process watcher check')

  assert.equal(parsed[3].type, 'refactor')
  assert.equal(parsed[4].type, 'docs')
  assert.equal(parsed[5].type, 'chore')
})

test('parseChangelogNotes handles markdown bullet lists and strips bullets from commits', () => {
  const notes = [
    '- feat: add new feature',
    '* fix: resolve bug',
    '- Some general note about the release',
    '* Another generic bullet'
  ].join('\n')

  const parsed = parseChangelogNotes(notes)
  assert.equal(parsed.length, 4)

  assert.equal(parsed[0].type, 'feat')
  assert.equal(parsed[0].text, 'add new feature')

  assert.equal(parsed[1].type, 'fix')
  assert.equal(parsed[1].text, 'resolve bug')

  assert.equal(parsed[2].type, 'bullet')
  assert.equal(parsed[2].text, 'Some general note about the release')

  assert.equal(parsed[3].type, 'bullet')
  assert.equal(parsed[3].text, 'Another generic bullet')
})

test('parseChangelogNotes returns empty array for blank or invalid input', () => {
  assert.deepEqual(parseChangelogNotes(''), [])
  assert.deepEqual(parseChangelogNotes('   \n\n  '), [])
  assert.deepEqual(parseChangelogNotes(null), [])
  assert.deepEqual(parseChangelogNotes(undefined), [])
})

test('resolvePendingChangelog validates and normalizes version matching', () => {
  const jsonMatch = JSON.stringify({
    version: '0.1.5',
    notes: 'feat: new version features',
    releaseDate: '2026-09-21'
  })

  // Exact version match
  const res1 = resolvePendingChangelog(jsonMatch, '0.1.5')
  assert.ok(res1)
  assert.equal(res1.version, '0.1.5')
  assert.equal(res1.notes, 'feat: new version features')
  assert.equal(res1.releaseDate, '2026-09-21')

  // Version match with 'v' prefix
  const res2 = resolvePendingChangelog(jsonMatch, 'v0.1.5')
  assert.ok(res2)
  assert.equal(res2.version, '0.1.5')

  // Version mismatch returns null
  const resMismatch = resolvePendingChangelog(jsonMatch, '0.1.4')
  assert.equal(resMismatch, null)

  // Empty notes returns null
  const emptyNotesJson = JSON.stringify({ version: '0.1.5', notes: '   ' })
  assert.equal(resolvePendingChangelog(emptyNotesJson, '0.1.5'), null)

  // Invalid JSON returns null
  assert.equal(resolvePendingChangelog('invalid json', '0.1.5'), null)
  assert.equal(resolvePendingChangelog(null, '0.1.5'), null)
})
