import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const steamApiClientPath = path.join(
  rootDir,
  '../src/main/achievement/steamApiClient.ts'
)
const gameHunterStatsServicePath = path.join(
  rootDir,
  '../src/main/achievement/gameHunterStatsService.ts'
)

test('hunter stats cache type is distinct from cover appdetails', async () => {
  const { HUNTER_STATS_CACHE_TYPE, HUNTER_METACRITIC_CACHE_TYPE } = await import(
    '../src/main/achievement/gameHunterStatsService.ts'
  )
  assert.equal(HUNTER_METACRITIC_CACHE_TYPE, 'hunter_metacritic')
  assert.equal(HUNTER_STATS_CACHE_TYPE, 'hunter_metacritic')
  assert.notEqual(HUNTER_STATS_CACHE_TYPE, 'appdetails')
})

test('cover appdetails URL filter remains basic-only in source', () => {
  const src = fs.readFileSync(steamApiClientPath, 'utf8')
  assert.match(src, /filters=basic`/)
  assert.doesNotMatch(
    src.replace(/filters=basic,metacritic,recommendations/g, ''),
    /fetchAppDetails[\s\S]*filters=basic,/
  )
  assert.match(src, /appdetails\?appids=\$\{appid\}&filters=basic`/)
})

test('gameHunterStatsService never writes cover appdetails cache type', () => {
  const src = fs.readFileSync(gameHunterStatsServicePath, 'utf8')
  assert.doesNotMatch(src, /setCacheEntry\([^)]*['"]appdetails['"]/)
  assert.doesNotMatch(src, /setCache\([^)]*['"]appdetails['"]/)
  assert.match(src, /HUNTER_STATS_CACHE_TYPE/)
  assert.doesNotMatch(
    src,
    /['"]appdetails['"]/,
    'literal appdetails cache type must not appear in hunter service'
  )
})
