import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { formatPlaytimeCompact, formatPlaytimePlayed } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/playtimeUtils.ts')).href
)

describe('playtimeUtils', () => {
  it('formatPlaytimeCompact shows em dash for zero or missing', () => {
    assert.equal(formatPlaytimeCompact(0), '—')
    assert.equal(formatPlaytimeCompact(-1), '—')
    assert.equal(formatPlaytimeCompact(undefined), '—')
  })

  it('formatPlaytimeCompact formats minutes and hours', () => {
    assert.equal(formatPlaytimeCompact(60), '1m')
    assert.equal(formatPlaytimeCompact(45 * 60), '45m')
    assert.equal(formatPlaytimeCompact(3600 + 20 * 60), '1h 20m')
    assert.equal(formatPlaytimeCompact(2 * 3600), '2h 0m')
  })

  it('formatPlaytimePlayed appends played unless zero', () => {
    assert.equal(formatPlaytimePlayed(0), '—')
    assert.equal(formatPlaytimePlayed(45 * 60), '45m played')
    assert.equal(formatPlaytimePlayed(3600 + 20 * 60), '1h 20m played')
  })
})
