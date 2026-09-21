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
  getPendingChangelogPath,
  ensurePendingChangelog,
  readStoredLastSeenVersion,
  updateStoredLastSeenVersion
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

test('ensurePendingChangelog handles first run, repeat runs, and upgrade fallback', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-ensure-changelog-test-'))

  try {
    // 1. First run: no lastSeenVersion in settings. Should record version and return null.
    const firstRun = await ensurePendingChangelog('0.1.4', tempDir)
    assert.equal(firstRun, null)
    assert.equal(readStoredLastSeenVersion(tempDir), '0.1.4')

    // 2. Repeat run on same version: should return null.
    const sameRun = await ensurePendingChangelog('0.1.4', tempDir)
    assert.equal(sameRun, null)

    // 3. Upgrade to 0.1.5 without pre-saved file: should invoke fallback fetcher and return payload.
    const mockFetcher = async (version) => ({
      version,
      notes: 'feat: new version via github fallback',
      releaseDate: '2026-09-21'
    })

    const upgraded = await ensurePendingChangelog('0.1.5', tempDir, mockFetcher)
    assert.ok(upgraded)
    assert.equal(upgraded.version, '0.1.5')
    assert.equal(upgraded.notes, 'feat: new version via github fallback')
    assert.equal(readStoredLastSeenVersion(tempDir), '0.1.5')

    // 4. Subsequent run on 0.1.5: should not pop again
    const subsequent = await ensurePendingChangelog('0.1.5', tempDir, mockFetcher)
    assert.equal(subsequent, null)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
