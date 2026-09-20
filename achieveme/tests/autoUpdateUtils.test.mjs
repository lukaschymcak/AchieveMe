import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  formatUpdateStatusLabel,
  canCheckForUpdates,
  canInstallUpdate,
  isUpdateDownloading,
  formatBytes
} = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/autoUpdateUtils.ts')).href
)

describe('autoUpdateUtils', () => {
  it('formats status labels correctly across updater lifecycle', () => {
    assert.equal(formatUpdateStatusLabel(null), 'Unknown')
    assert.equal(formatUpdateStatusLabel(undefined), 'Unknown')

    assert.equal(
      formatUpdateStatusLabel({ status: 'idle', currentVersion: '0.1.0' }),
      'Up to date'
    )

    assert.equal(
      formatUpdateStatusLabel({ status: 'checking', currentVersion: '0.1.0' }),
      'Checking for updates...'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'available',
        currentVersion: '0.1.0',
        newVersion: '0.2.0'
      }),
      'New update available: v0.2.0'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'available',
        currentVersion: '0.1.0'
      }),
      'Update available'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'downloading',
        currentVersion: '0.1.0',
        newVersion: '0.2.0',
        progressPercent: 45
      }),
      'Downloading update... 45%'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'downloaded',
        currentVersion: '0.1.0',
        newVersion: '0.2.0'
      }),
      'Version v0.2.0 ready to install'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'downloaded',
        currentVersion: '0.1.0'
      }),
      'Update ready to install'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'not-available',
        currentVersion: '0.1.0',
        devMode: true
      }),
      'Up to date (Dev mode)'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'not-available',
        currentVersion: '0.1.0',
        devMode: false
      }),
      'AchieveMe is up to date'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'error',
        currentVersion: '0.1.0',
        error: 'Network timeout'
      }),
      'Update check failed: Network timeout'
    )

    assert.equal(
      formatUpdateStatusLabel({
        status: 'error',
        currentVersion: '0.1.0'
      }),
      'Update check failed'
    )
  })

  it('evaluates canCheckForUpdates based on activity', () => {
    assert.equal(canCheckForUpdates(null), true)
    assert.equal(canCheckForUpdates({ status: 'idle', currentVersion: '0.1.0' }), true)
    assert.equal(canCheckForUpdates({ status: 'not-available', currentVersion: '0.1.0' }), true)
    assert.equal(canCheckForUpdates({ status: 'downloaded', currentVersion: '0.1.0' }), true)
    assert.equal(canCheckForUpdates({ status: 'error', currentVersion: '0.1.0' }), true)
    assert.equal(canCheckForUpdates({ status: 'checking', currentVersion: '0.1.0' }), false)
    assert.equal(canCheckForUpdates({ status: 'downloading', currentVersion: '0.1.0' }), false)
  })

  it('evaluates canInstallUpdate only when downloaded', () => {
    assert.equal(canInstallUpdate(null), false)
    assert.equal(canInstallUpdate({ status: 'idle', currentVersion: '0.1.0' }), false)
    assert.equal(canInstallUpdate({ status: 'checking', currentVersion: '0.1.0' }), false)
    assert.equal(canInstallUpdate({ status: 'downloading', currentVersion: '0.1.0' }), false)
    assert.equal(canInstallUpdate({ status: 'not-available', currentVersion: '0.1.0' }), false)
    assert.equal(canInstallUpdate({ status: 'downloaded', currentVersion: '0.1.0' }), true)
  })

  it('evaluates isUpdateDownloading correctly', () => {
    assert.equal(isUpdateDownloading(null), false)
    assert.equal(isUpdateDownloading({ status: 'idle', currentVersion: '0.1.0' }), false)
    assert.equal(isUpdateDownloading({ status: 'downloading', currentVersion: '0.1.0' }), true)
    assert.equal(isUpdateDownloading({ status: 'downloaded', currentVersion: '0.1.0' }), false)
  })

  it('formats byte quantities into readable units', () => {
    assert.equal(formatBytes(undefined), '0 B')
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(-10), '0 B')
    assert.equal(formatBytes(512), '512 B')
    assert.equal(formatBytes(1024), '1.0 KB')
    assert.equal(formatBytes(1024 * 1024 * 15.5), '15.5 MB')
    assert.equal(formatBytes(1024 * 1024 * 1024 * 2.25), '2.3 GB')
  })
})
