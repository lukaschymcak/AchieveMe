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
  pickLibraryNewsAppids,
  hasUsableNewsPayload,
  groupLibraryNewsByRecency,
  pruneNewsPayloadForLibrary
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

test('hasUsableNewsPayload is true only when payload is non-null', () => {
  assert.equal(hasUsableNewsPayload(null), false)
  assert.equal(hasUsableNewsPayload({ fetchedAt: 1 }), true)
})

test('groupLibraryNewsByRecency buckets today thisWeek and older', () => {
  // Local noon on a fixed calendar day — avoid DST edge by using midday.
  const now = new Date(2026, 2, 15, 12, 0, 0) // 15 Mar 2026 local
  const todayStart = Math.floor(
    new Date(2026, 2, 15, 0, 0, 0).getTime() / 1000
  )
  const day = 86400

  const items = [
    { id: 'today-noon', date: todayStart + 12 * 3600 },
    { id: 'today-morning', date: todayStart + 3600 },
    { id: 'yesterday', date: todayStart - day + 12 * 3600 },
    { id: 'day-2', date: todayStart - 2 * day + 12 * 3600 },
    { id: 'day-6', date: todayStart - 6 * day + 12 * 3600 },
    { id: 'day-7-edge', date: todayStart - 7 * day }, // exactly weekStart → thisWeek
    { id: 'day-8', date: todayStart - 8 * day + 12 * 3600 }
  ]

  const grouped = groupLibraryNewsByRecency(items, now)

  assert.deepEqual(
    grouped.today.map((x) => x.id),
    ['today-noon', 'today-morning']
  )
  assert.deepEqual(
    grouped.thisWeek.map((x) => x.id),
    ['yesterday', 'day-2', 'day-6', 'day-7-edge']
  )
  assert.deepEqual(
    grouped.older.map((x) => x.id),
    ['day-8']
  )
})

test('groupLibraryNewsByRecency returns empty arrays for empty input', () => {
  const grouped = groupLibraryNewsByRecency([], new Date(2026, 2, 15, 12, 0, 0))
  assert.deepEqual(grouped, { today: [], thisWeek: [], older: [] })
})

function sampleNewsPayload() {
  return {
    thisWeek: [
      {
        appid: '1',
        name: 'Keep',
        releaseLabel: 'Soon',
        headerImage: '',
        releaseUnix: 1,
        inLibrary: true,
        tagIds: []
      },
      {
        appid: '2',
        name: 'Gone',
        releaseLabel: 'Soon',
        headerImage: '',
        releaseUnix: 2,
        inLibrary: true,
        tagIds: []
      }
    ],
    thisMonth: [
      {
        appid: '3',
        name: 'Out',
        releaseLabel: 'Later',
        headerImage: '',
        releaseUnix: 3,
        inLibrary: false,
        tagIds: []
      }
    ],
    libraryNews: [
      {
        appid: '1',
        gameName: 'Keep',
        title: 'Patch',
        url: 'https://example.com/1',
        date: 100,
        contents: '',
        feedLabel: ''
      },
      {
        appid: '2',
        gameName: 'Gone',
        title: 'News',
        url: 'https://example.com/2',
        date: 90,
        contents: '',
        feedLabel: ''
      }
    ],
    fetchedAt: 12345,
    fromCache: true
  }
}

test('pruneNewsPayloadForLibrary strips deleted library news and remaps inLibrary', () => {
  const pruned = pruneNewsPayloadForLibrary(sampleNewsPayload(), new Set(['1']))
  assert.equal(pruned.fetchedAt, 12345)
  assert.equal(pruned.fromCache, true)
  assert.deepEqual(
    pruned.libraryNews.map((x) => x.appid),
    ['1']
  )
  assert.equal(pruned.thisWeek.find((r) => r.appid === '1')?.inLibrary, true)
  assert.equal(pruned.thisWeek.find((r) => r.appid === '2')?.inLibrary, false)
  assert.equal(pruned.thisMonth[0].inLibrary, false)
})

test('pruneNewsPayloadForLibrary with empty library clears library news', () => {
  const pruned = pruneNewsPayloadForLibrary(sampleNewsPayload(), new Set())
  assert.equal(pruned.libraryNews.length, 0)
  assert.ok(pruned.thisWeek.every((r) => r.inLibrary === false))
  assert.ok(pruned.thisMonth.every((r) => r.inLibrary === false))
})
