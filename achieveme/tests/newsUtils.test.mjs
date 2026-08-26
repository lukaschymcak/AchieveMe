import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseSteamReleaseLabel,
  bucketRelease,
  formatReleaseDaysFromToday,
  dedupeReleasesByAppid,
  pickLibraryNewsAppids
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/newsUtils.ts')).href)

test('parseSteamReleaseLabel returns null for TBA labels', () => {
  assert.equal(parseSteamReleaseLabel('Coming soon'), null)
  assert.equal(parseSteamReleaseLabel('To be announced'), null)
  assert.equal(parseSteamReleaseLabel('TBA'), null)
  assert.equal(parseSteamReleaseLabel(''), null)
  assert.equal(parseSteamReleaseLabel('2026'), null)
})

test('parseSteamReleaseLabel parses dated labels with year', () => {
  const unix = parseSteamReleaseLabel('24 Mar, 2026')
  assert.ok(unix != null)
  const d = new Date(unix * 1000)
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 2)
  assert.equal(d.getDate(), 24)
})

test('bucketRelease classifies week / month / later / released', () => {
  const now = new Date('2026-03-15T12:00:00Z')
  const nowUnix = Math.floor(now.getTime() / 1000)
  const day = 86400

  assert.equal(bucketRelease(null, now), 'tba')
  assert.equal(bucketRelease(nowUnix + 2 * day, now), 'thisWeek')
  assert.equal(bucketRelease(nowUnix + 14 * day, now), 'thisMonth')
  assert.equal(bucketRelease(nowUnix + 40 * day, now), 'later')
  assert.equal(bucketRelease(nowUnix - 2 * day, now), 'releasedThisWeek')
  assert.equal(bucketRelease(nowUnix - 20 * day, now), 'later')
})

test('formatReleaseDaysFromToday formats relative day labels', () => {
  const now = new Date('2026-03-15T12:00:00')
  const day = 86400
  const todayUnix = Math.floor(new Date('2026-03-15T08:00:00').getTime() / 1000)

  assert.equal(formatReleaseDaysFromToday(null, now), null)
  assert.equal(formatReleaseDaysFromToday(todayUnix, now), 'today')
  assert.equal(formatReleaseDaysFromToday(todayUnix + day, now), 'in 1 day')
  assert.equal(formatReleaseDaysFromToday(todayUnix + 3 * day, now), 'in 3 days')
  assert.equal(formatReleaseDaysFromToday(todayUnix - day, now), '1 day ago')
  assert.equal(formatReleaseDaysFromToday(todayUnix - 2 * day, now), '2 days ago')
})

test('dedupeReleasesByAppid keeps first', () => {
  const out = dedupeReleasesByAppid([
    { appid: '1', name: 'A' },
    { appid: '1', name: 'B' },
    { appid: '2', name: 'C' }
  ])
  assert.deepEqual(
    out.map((x) => x.name),
    ['A', 'C']
  )
})

test('pickLibraryNewsAppids prefers recent unlocks', () => {
  const ids = pickLibraryNewsAppids(
    [
      { appid: 'a', last_unlocked_at: 10 },
      { appid: 'b', last_unlocked_at: 50 },
      { appid: 'c', last_unlocked_at: 0 }
    ],
    2
  )
  assert.deepEqual(ids, ['b', 'a'])
})
