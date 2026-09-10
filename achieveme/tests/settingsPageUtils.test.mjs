import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const utils = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/settingsPageUtils.ts')).href
)
const helpContent = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/helpContent.ts')).href
)

const { SETTINGS_GROUPS, SETTINGS_COPY, SETTINGS_CHIP_LABELS, countSentences, formatSourceLabel, settingsGroupTooltipKey, settingsNoticeFromError, settingsRowClassName } = utils
const { TOOLTIPS } = helpContent

describe('settingsPageUtils', () => {
  it('locks four Settings groups in Library · Play · Backups · Tools order', () => {
    assert.deepEqual(
      SETTINGS_GROUPS.map((group) => group.id),
      ['library', 'play', 'backups', 'tools']
    )
    assert.deepEqual(
      SETTINGS_GROUPS.map((group) => group.title),
      ['Library', 'Play', 'Backups', 'Tools']
    )
  })

  it('keeps each group HelpTip to two sentences or fewer', () => {
    for (const group of SETTINGS_GROUPS) {
      const key = settingsGroupTooltipKey(group.id)
      const tip = TOOLTIPS[key]
      assert.equal(typeof tip, 'string', `missing TOOLTIPS.${key}`)
      assert.ok(countSentences(tip) <= 2, `${key} has ${countSentences(tip)} sentences`)
    }
  })

  it('does not export SETTINGS_HINTS essays', () => {
    assert.equal(helpContent.SETTINGS_HINTS, undefined)
  })

  it('formats source ids for row labels', () => {
    assert.equal(formatSourceLabel('goldberg'), 'Goldberg')
    assert.equal(formatSourceLabel('gse'), 'GSE')
    assert.equal(formatSourceLabel('codex'), 'Codex')
    assert.equal(formatSourceLabel('rune'), 'Rune')
  })

  it('keeps save folders distinct from install folders and drops Worker jargon', () => {
    assert.equal(SETTINGS_COPY.saveFolders, 'Save folders')
    assert.equal(SETTINGS_COPY.installFolders, 'Install folders')
    assert.notEqual(SETTINGS_COPY.saveFolders, SETTINGS_COPY.installFolders)
    assert.equal(SETTINGS_COPY.cloudUrl, 'Cloud URL')
    assert.equal(SETTINGS_COPY.cloudToken, 'Cloud token')
    assert.doesNotMatch(SETTINGS_COPY.cloudUrl, /Worker|Bearer/i)
    assert.doesNotMatch(SETTINGS_COPY.cloudToken, /Worker|Bearer/i)
    assert.equal(SETTINGS_COPY.downloadBackups, 'Download backups')
    assert.equal(SETTINGS_COPY.save, 'Save')
    assert.equal(SETTINGS_COPY.preview, 'Preview')
    assert.equal(SETTINGS_COPY.autoBackup, 'Auto-backup after game ends')
    assert.equal(SETTINGS_COPY.autoBackupHint, undefined)
  })

  it('keeps repeated chip accessible names unique', () => {
    const labels = Object.values(SETTINGS_CHIP_LABELS)
    assert.equal(new Set(labels).size, labels.length)
    for (const label of labels) {
      assert.notEqual(label, SETTINGS_COPY.add)
      assert.notEqual(label, SETTINGS_COPY.preview)
      assert.notEqual(label, SETTINGS_COPY.browse)
      assert.notEqual(label, SETTINGS_COPY.clear)
    }
  })

  it('names the Settings page heading for screen readers', () => {
    assert.equal(SETTINGS_COPY.pageTitle, 'Settings')
    assert.equal(SETTINGS_COPY.saveFailed, 'Save failed.')
    assert.equal(SETTINGS_COPY.loadFailed, 'Couldn’t load settings.')
    assert.equal(SETTINGS_COPY.retry, 'Retry')
    assert.equal(SETTINGS_COPY.backupFailed, 'Backup failed.')
    assert.equal(SETTINGS_COPY.browseFailed, 'Browse failed.')
    assert.equal(SETTINGS_COPY.getKey, 'Get key')
    assert.equal(SETTINGS_COPY.getKeyOpens, 'Get key (opens in browser)')
  })

  it('falls back to chrome copy when a throw has no usable message', () => {
    assert.equal(settingsNoticeFromError(new Error('IPC down'), SETTINGS_COPY.loadFailed), 'IPC down')
    assert.equal(settingsNoticeFromError(new Error('  '), SETTINGS_COPY.loadFailed), SETTINGS_COPY.loadFailed)
    assert.equal(settingsNoticeFromError(new Error(''), SETTINGS_COPY.backupFailed), SETTINGS_COPY.backupFailed)
    assert.equal(settingsNoticeFromError(null, SETTINGS_COPY.saveFailed), SETTINGS_COPY.saveFailed)
    assert.equal(settingsNoticeFromError(undefined, SETTINGS_COPY.backupFailed), SETTINGS_COPY.backupFailed)
  })

  it('routes load, Backup now, and Browse errors through chrome copy, not window.alert', () => {
    const src = fs.readFileSync(
      path.join(rootDir, '../src/renderer/src/pages/SettingsPage.tsx'),
      'utf8'
    )
    assert.doesNotMatch(src, /window\.alert/)
    assert.match(src, /showSaveNotice\('error', SETTINGS_COPY\.setLudusaviThenSave\)/)
    assert.match(src, /settingsNoticeFromError\(err, SETTINGS_COPY\.backupFailed\)/)
    assert.match(src, /settingsNoticeFromError\(err, SETTINGS_COPY\.loadFailed\)/)
    assert.match(src, /settingsNoticeFromError\(err, SETTINGS_COPY\.browseFailed\)/)
    assert.match(src, /SETTINGS_COPY\.retry/)
    assert.match(src, /handleBrowsePath/)
    assert.match(src, /<AppChrome\s+sticky/)
    assert.doesNotMatch(src, /autoBackupHint/)
    assert.match(src, /aria-label=\{SETTINGS_COPY\.getKeyOpens\}/)
    assert.match(src, /rel="noopener noreferrer"/)
  })

  it('treats HelpTip as a click disclosure, not a hover tooltip', () => {
    const src = fs.readFileSync(
      path.join(rootDir, '../src/renderer/src/components/HelpTip.tsx'),
      'utf8'
    )
    assert.doesNotMatch(src, /role="tooltip"/)
    assert.match(src, /role="region"/)
    assert.match(src, /aria-controls/)
    assert.match(src, /aria-expanded/)
  })

  it('marks path, nested, and cluster-head rows without dropping the base class', () => {
    assert.equal(settingsRowClassName({}), 'settings-row')
    assert.equal(
      settingsRowClassName({ path: true }),
      'settings-row settings-row--path'
    )
    assert.equal(
      settingsRowClassName({ nested: true, disabled: true }),
      'settings-row settings-row--disabled settings-row--nested'
    )
    assert.equal(
      settingsRowClassName({ clusterHead: true }),
      'settings-row settings-row--cluster-head'
    )
  })
})
