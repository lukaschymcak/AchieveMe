import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseSteamReleaseLabel,
  bucketRelease,
  formatReleaseDaysFromToday,
  isReleaseShipped,
  sortNewsReleases,
  formatFetchedAtRelative,
  filterReleasesByGenreTagIds,
  NEWS_GENRE_FILTERS,
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

test('isReleaseShipped is true only for calendar days before today', () => {
  const now = new Date('2026-03-15T12:00:00')
  const todayUnix = Math.floor(new Date('2026-03-15T08:00:00').getTime() / 1000)
  const day = 86400

  assert.equal(isReleaseShipped(null, now), false)
  assert.equal(isReleaseShipped(todayUnix, now), false)
  assert.equal(isReleaseShipped(todayUnix + day, now), false)
  assert.equal(isReleaseShipped(todayUnix - day, now), true)
})

test('sortNewsReleases puts in-library first then soonest date', () => {
  const sorted = sortNewsReleases([
    { name: 'Zeta', releaseUnix: 100, inLibrary: false },
    { name: 'Alpha', releaseUnix: 50, inLibrary: false },
    { name: 'Mine', releaseUnix: 200, inLibrary: true },
    { name: 'TBA', releaseUnix: null, inLibrary: false },
    { name: 'AlsoMine', releaseUnix: 10, inLibrary: true }
  ])
  assert.deepEqual(
    sorted.map((x) => x.name),
    ['AlsoMine', 'Mine', 'Alpha', 'Zeta', 'TBA']
  )
})

test('formatFetchedAtRelative uses minute hour and day buckets', () => {
  const now = new Date('2026-03-15T12:00:00Z')
  const nowUnix = Math.floor(now.getTime() / 1000)

  assert.equal(formatFetchedAtRelative(nowUnix, now), 'just now')
  assert.equal(formatFetchedAtRelative(nowUnix - 30, now), 'just now')
  assert.equal(formatFetchedAtRelative(nowUnix - 12 * 60, now), '12m ago')
  assert.equal(formatFetchedAtRelative(nowUnix - 3 * 3600, now), '3h ago')
  assert.equal(formatFetchedAtRelative(nowUnix - 2 * 86400, now), '2d ago')
})

test('filterReleasesByGenreTagIds ORs selected tags and no-ops when empty', () => {
  const items = [
    { name: 'A', tagIds: [19, 492] },
    { name: 'B', tagIds: [122] },
    { name: 'C', tagIds: [] }
  ]
  assert.deepEqual(
    filterReleasesByGenreTagIds(items, []).map((x) => x.name),
    ['A', 'B', 'C']
  )
  assert.deepEqual(
    filterReleasesByGenreTagIds(items, [19]).map((x) => x.name),
    ['A']
  )
  assert.deepEqual(
    filterReleasesByGenreTagIds(items, [19, 122]).map((x) => x.name),
    ['A', 'B']
  )
  assert.ok(NEWS_GENRE_FILTERS.some((g) => g.id === 19 && g.label === 'Action'))
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
