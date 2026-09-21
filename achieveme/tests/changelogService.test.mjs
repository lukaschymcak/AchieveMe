import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  checkPendingChangelog,
  savePendingChangelog,
  getPendingChangelog,
  getPendingChangelogPath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/changelogService.ts')).href
)

test('changelogService lifecycle: save, check, caching, and cleanup', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-changelog-test-'))

  try {
    // 1. Missing file returns null
    const missing = checkPendingChangelog('0.1.5', tempDir)
    assert.equal(missing, null)

    // 2. Save pending changelog for version 0.1.5
    const payload = {
      version: '0.1.5',
      notes: 'feat: add changelog popup\nfix: handle window resize',
      releaseDate: '2026-09-21T12:00:00Z'
    }
    savePendingChangelog(payload, tempDir)

    const expectedFilePath = getPendingChangelogPath(tempDir)
    assert.ok(fs.existsSync(expectedFilePath), 'pending_changelog.json should exist on disk')

    // 3. Version mismatch (e.g. app still on 0.1.4 before restart) returns null and keeps file
    const mismatch = checkPendingChangelog('0.1.4', tempDir)
    assert.equal(mismatch, null)
    assert.ok(fs.existsSync(expectedFilePath), 'pending_changelog.json should NOT be deleted on version mismatch')

    // 4. Version match (app booted on 0.1.5) returns payload, deletes file, and caches
    const matched = checkPendingChangelog('0.1.5', tempDir)
    assert.ok(matched, 'Should return matched changelog payload')
    assert.equal(matched.version, '0.1.5')
    assert.equal(matched.notes, payload.notes)
    assert.equal(matched.releaseDate, payload.releaseDate)

    assert.equal(fs.existsSync(expectedFilePath), false, 'pending_changelog.json should be removed after consumption')

    // 5. getPendingChangelog() returns the cached payload
    const cached = getPendingChangelog()
    assert.deepEqual(cached, matched)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
