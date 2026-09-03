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
  assert.equal(normalized.hubcapApiKey, '')
  assert.equal(normalized.depotDownloadPath, '')
  assert.equal(normalized.ludusaviPath, '')
  assert.equal(normalized.ludusaviAutoBackup, false)
  assert.equal(normalized.ludusaviBackupOnStartup, true)
  assert.equal(normalized.ludusaviBackupOnSessionEnd, true)
  assert.equal(normalized.ludusaviBackupOnAddGame, true)
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

test('normalizeAppSettings preserves hubcapApiKey and depotDownloadPath when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    hubcapApiKey: 'hub-key',
    depotDownloadPath: 'D:\\Games'
  })
  assert.equal(normalized.hubcapApiKey, 'hub-key')
  assert.equal(normalized.depotDownloadPath, 'D:\\Games')
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

test('normalizeAppSettings preserves ludusavi backup fields when set', () => {
  const normalized = normalizeAppSettings({
    steamApiKey: 'abc',
    enabledSources: ['goldberg'],
    ludusaviPath: 'C:\\Tools\\ludusavi.exe',
    rclonePath: 'C:\\Tools\\rclone.exe',
    ludusaviCloudSync: true,
    ludusaviCloudProvider: 'google-drive',
    ludusaviCloudCustomRemote: 'mydrive',
    ludusaviAutoBackup: true,
    ludusaviBackupOnStartup: false,
    ludusaviBackupOnSessionEnd: false,
    ludusaviBackupOnAddGame: false
  })
  assert.equal(normalized.ludusaviPath, 'C:\\Tools\\ludusavi.exe')
  assert.equal(normalized.rclonePath, 'C:\\Tools\\rclone.exe')
  assert.equal(normalized.ludusaviCloudSync, true)
  assert.equal(normalized.ludusaviCloudProvider, 'google-drive')
  assert.equal(normalized.ludusaviCloudCustomRemote, 'mydrive')
  assert.equal(normalized.ludusaviAutoBackup, true)
  assert.equal(normalized.ludusaviBackupOnStartup, false)
  assert.equal(normalized.ludusaviBackupOnSessionEnd, false)
  assert.equal(normalized.ludusaviBackupOnAddGame, false)
})
