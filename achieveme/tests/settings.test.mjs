import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { normalizeAppSettings, DEFAULT_APP_SETTINGS } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/appSettingsUtils.ts')).href
)

test('normalizeAppSettings applies defaults for legacy settings files', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg']
  })

  assert.equal(normalized.steamApiKey, 'abc')
  assert.deepEqual(normalized.enabledSources, ['goldberg'])
  assert.equal(normalized.notificationsEnabled, DEFAULT_APP_SETTINGS.notificationsEnabled)
  assert.equal(normalized.closeToTray, DEFAULT_APP_SETTINGS.closeToTray)
  assert.equal(normalized.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled)
  assert.equal(normalized.customSoundPath, '')
  assert.equal(normalized.playtimeTrackingEnabled, DEFAULT_APP_SETTINGS.playtimeTrackingEnabled)
  assert.equal(normalized.sessionRecapEnabled, DEFAULT_APP_SETTINGS.sessionRecapEnabled)
})
