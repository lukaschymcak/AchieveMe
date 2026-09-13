import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { achievementPercentagesFromRecords } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/achievementSchemaUtils.ts')).href
)
const steamApiClientPath = path.join(rootDir, '../src/main/achievement/steamApiClient.ts')

test('achievementPercentagesFromRecords returns null for empty or missing inputs', () => {
  assert.equal(achievementPercentagesFromRecords(null), null)
  assert.equal(achievementPercentagesFromRecords(undefined), null)
  assert.equal(achievementPercentagesFromRecords([]), null)
})

test('achievementPercentagesFromRecords builds percentage map from existing DB records', () => {
  const records = [
    { api_name: 'ACH_WIN', global_percent: 14.5 },
    { api_name: 'ACH_LOSE', global_percent: 78.2 },
    { api_name: 'ACH_ZERO', global_percent: 0 }
  ]

  assert.deepEqual(achievementPercentagesFromRecords(records), {
    ACH_WIN: 14.5,
    ACH_LOSE: 78.2,
    ACH_ZERO: 0
  })
})

test('steamApiClient source contract: fetchPercentages checks DB when !forceRefresh', () => {
  const src = fs.readFileSync(steamApiClientPath, 'utf8')
  assert.match(src, /if\s*\(!forceRefresh\)\s*\{\s*const fromDb = getPercentagesFromDb\(db,\s*appid\)/)
  assert.match(src, /if\s*\(fromDb\)\s*return fromDb/)
  assert.doesNotMatch(src, /void\s+db\b/, 'void db must be removed from fetchPercentages')
})

test('steamApiClient source contract: fetchPercentages falls back to DB on network failure', () => {
  const src = fs.readFileSync(steamApiClientPath, 'utf8')
  assert.match(src, /catch\s*\{\s*return getPercentagesFromDb\(db,\s*appid\)\s*\}/)
})

test('steamApiClient source contract: httpGet includes timeout protection', () => {
  const src = fs.readFileSync(steamApiClientPath, 'utf8')
  assert.match(src, /httpGet\(url:\s*string,\s*timeoutMs\s*=\s*\d+\)/)
  assert.match(src, /req\.setTimeout\(timeoutMs/)
  assert.match(src, /req\.destroy\(new Error\(`Request timeout/)
})
