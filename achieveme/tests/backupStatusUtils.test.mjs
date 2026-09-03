import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { formatBackupStatusLabel } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/backupStatusUtils.ts')).href
)

test('formatBackupStatusLabel maps statuses', async () => {
  const { LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE } = await import(
    pathToFileURL(path.join(rootDir, '../src/shared/ludusaviApiUtils.ts')).href
  )
  const now = 1_700_000_000
  assert.equal(formatBackupStatusLabel('running', 0, now), 'Backing up…')
  assert.equal(formatBackupStatusLabel('ok', now - 120, now), 'Saves backed up · 2m ago')
  assert.equal(formatBackupStatusLabel('failed', 0, now), 'Backup failed')
  assert.equal(formatBackupStatusLabel('missing', 0, now), 'Not in Ludusavi')
  assert.equal(formatBackupStatusLabel('', 0, now), 'No backup yet')
  assert.equal(formatBackupStatusLabel('ok', 0, now), 'Saves backed up')
  assert.equal(
    formatBackupStatusLabel('ok', now - 60, now, LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE),
    'Saves unchanged — no new snapshot'
  )
})
