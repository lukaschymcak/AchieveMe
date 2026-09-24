import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { pickSteamAppDetailsEntry } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/steamAppDetailsUtils.ts')).href
)

test('pickSteamAppDetailsEntry reads the requested AppID key', () => {
  const data = pickSteamAppDetailsEntry(
    { '480': { success: true, data: { type: 'game', name: 'Spacewar', steam_appid: 480 } } },
    '480'
  )
  assert.equal(data.type, 'game')
  assert.equal(data.name, 'Spacewar')
})

test('pickSteamAppDetailsEntry matches steam_appid when the response key differs', () => {
  const data = pickSteamAppDetailsEntry(
    {
      '4760190': {
        success: true,
        data: { type: 'game', name: 'CONTROL Resonant', steam_appid: 3669870 }
      }
    },
    '3669870'
  )
  assert.equal(data.type, 'game')
  assert.equal(data.name, 'CONTROL Resonant')
})

test('pickSteamAppDetailsEntry ignores a mismatched steam_appid', () => {
  const data = pickSteamAppDetailsEntry(
    { '1': { success: true, data: { type: 'game', steam_appid: 2 } } },
    '3669870'
  )
  assert.equal(data, undefined)
})
