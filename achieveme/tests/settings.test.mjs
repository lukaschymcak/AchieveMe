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
  assert.equal(normalized.openAtLogin, false)
  assert.equal(normalized.startMinimizedToTray, false)
  assert.equal(normalized.soundEnabled, DEFAULT_APP_SETTINGS.soundEnabled)
  assert.equal(normalized.soundVolume, 100)
  assert.equal(normalized.customSoundPath, '')
  assert.equal(normalized.playtimeTrackingEnabled, DEFAULT_APP_SETTINGS.playtimeTrackingEnabled)
  assert.equal(normalized.sessionRecapEnabled, DEFAULT_APP_SETTINGS.sessionRecapEnabled)
  assert.equal(normalized.playGamesFromLauncher, DEFAULT_APP_SETTINGS.playGamesFromLauncher)
  assert.equal(normalized.steamlessFolder, DEFAULT_APP_SETTINGS.steamlessFolder)
})

test('normalizeAppSettings preserves soundVolume when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    soundVolume: 40
  })
  assert.equal(normalized.soundVolume, 40)
})

test('normalizeAppSettings preserves playGamesFromLauncher when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    playGamesFromLauncher: false
  })
  assert.equal(normalized.playGamesFromLauncher, false)
})

test('normalizeAppSettings preserves steamlessFolder when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    steamlessFolder: 'C:\\Tools\\Steamless'
  })
  assert.equal(normalized.steamlessFolder, 'C:\\Tools\\Steamless')
})

test('normalizeAppSettings preserves openAtLogin and startMinimizedToTray when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    openAtLogin: true,
    startMinimizedToTray: true
  })
  assert.equal(normalized.openAtLogin, true)
  assert.equal(normalized.startMinimizedToTray, true)
})
