import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  buildAchievementRecords,
  rawAchievementsFromIniSections,
  resolveAchievementSchema,
  schemaListFromSteamResponse
} = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/achievementSchemaUtils.ts')).href
)

const identityIcon = (_appid, value) => value

const schemaEntry = (name, displayName = name) => ({
  name,
  displayName,
  description: `${displayName} desc`,
  icon: 'iconhash',
  icongray: 'grayhash',
  hidden: 0
})

test('rawAchievementsFromIniSections ignores SteamAchievements meta section', () => {
  const sections = new Map([
    ['SteamAchievements', new Map([['count', '0']])]
  ])
  assert.deepEqual(rawAchievementsFromIniSections(sections), {})
})

test('rawAchievementsFromIniSections reads UnlockTime sections only', () => {
  const sections = new Map([
    ['SteamAchievements', new Map([['count', '1']])],
    ['ACH_FIRST', new Map([['unlocktime', '100']])],
    ['ACH_LOCKED', new Map([['unlocktime', '0']])],
    ['OtherMeta', new Map([['count', '2']])]
  ])

  const raw = rawAchievementsFromIniSections(sections)
  assert.deepEqual(Object.keys(raw).sort(), ['ACH_FIRST', 'ACH_LOCKED'])
  assert.deepEqual(raw.ACH_FIRST, { achieved: true, unlockTime: 100 })
  assert.deepEqual(raw.ACH_LOCKED, { achieved: false, unlockTime: 0 })
})

test('buildAchievementRecords uses schema names only', () => {
  const schema = [schemaEntry('ACH_A', 'Alpha'), schemaEntry('ACH_B', 'Beta')]
  const rows = buildAchievementRecords(
    '123',
    {
      ACH_A: { achieved: true, unlockTime: 50 },
      SteamAchievements: { achieved: false, unlockTime: 0 }
    },
    schema,
    { ACH_A: 12.5 },
    identityIcon
  )

  assert.equal(rows.length, 2)
  assert.equal(rows[0].api_name, 'ACH_A')
  assert.equal(rows[0].display_name, 'Alpha')
  assert.equal(rows[0].earned, 1)
  assert.equal(rows[0].earned_time, 50)
  assert.equal(rows[0].global_percent, 12.5)
  assert.equal(rows[1].api_name, 'ACH_B')
  assert.equal(rows[1].earned, 0)
  assert.ok(!rows.some((r) => r.api_name === 'SteamAchievements'))
})

test('buildAchievementRecords returns empty when schema is null', () => {
  const rows = buildAchievementRecords(
    '123',
    { SteamAchievements: { achieved: false, unlockTime: 0 } },
    null,
    null,
    identityIcon
  )
  assert.deepEqual(rows, [])
})

test('buildAchievementRecords returns empty for empty schema array', () => {
  const rows = buildAchievementRecords(
    '123',
    { ACH_A: { achieved: true, unlockTime: 1 } },
    [],
    null,
    identityIcon
  )
  assert.deepEqual(rows, [])
})

test('resolveAchievementSchema prefers fresh cache when not forcing refresh', () => {
  const fresh = [schemaEntry('FRESH')]
  const stale = [schemaEntry('STALE')]
  const picked = resolveAchievementSchema({
    forceRefresh: false,
    freshCache: fresh,
    live: undefined,
    staleCache: stale
  })
  assert.equal(picked, fresh)
})

test('resolveAchievementSchema uses live result and ignores stale on success', () => {
  const live = [schemaEntry('LIVE')]
  const stale = [schemaEntry('STALE')]
  const picked = resolveAchievementSchema({
    forceRefresh: true,
    freshCache: null,
    live,
    staleCache: stale
  })
  assert.equal(picked, live)
})

test('resolveAchievementSchema keeps stale cache when live fails', () => {
  const stale = [schemaEntry('STALE')]
  const picked = resolveAchievementSchema({
    forceRefresh: true,
    freshCache: null,
    live: null,
    staleCache: stale
  })
  assert.equal(picked, stale)
})

test('resolveAchievementSchema returns null when no live and no cache', () => {
  const picked = resolveAchievementSchema({
    forceRefresh: true,
    freshCache: null,
    live: null,
    staleCache: null
  })
  assert.equal(picked, null)
})

test('resolveAchievementSchema returns empty live array without falling back to stale', () => {
  const stale = [schemaEntry('STALE')]
  const picked = resolveAchievementSchema({
    forceRefresh: true,
    freshCache: null,
    live: [],
    staleCache: stale
  })
  assert.deepEqual(picked, [])
})

test('resolveAchievementSchema uses stale when live was not attempted', () => {
  const stale = [schemaEntry('STALE')]
  const picked = resolveAchievementSchema({
    forceRefresh: false,
    freshCache: null,
    live: undefined,
    staleCache: stale
  })
  assert.equal(picked, stale)
})

test('schemaListFromSteamResponse treats missing list under game as empty catalog', () => {
  assert.deepEqual(schemaListFromSteamResponse({ game: { gameName: 'X' } }), [])
  assert.deepEqual(schemaListFromSteamResponse({ game: { availableGameStats: {} } }), [])
  assert.deepEqual(
    schemaListFromSteamResponse({
      game: { availableGameStats: { achievements: [schemaEntry('A')] } }
    }),
    [schemaEntry('A')]
  )
  assert.equal(schemaListFromSteamResponse({}), null)
})
