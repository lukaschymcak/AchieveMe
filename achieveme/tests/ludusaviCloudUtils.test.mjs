import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  getAchieveMeLudusaviConfigDir,
  withLudusaviConfig,
  buildCloudSetArgv,
  buildCloudUploadArgv,
  buildCloudDownloadArgv,
  isSafeRcloneRemoteId,
  hasLudusaviCloudConflict,
  hasLudusaviCloudSyncFailed,
  ludusaviCloudSoftNoteFromApi,
  parseCloudRemoteLabelFromConfigYaml,
  LUDUSAVI_CLOUD_CONFLICT_NOTE,
  LUDUSAVI_CLOUD_SYNC_FAILED_NOTE
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/ludusaviCloudUtils.ts')).href)

test('getAchieveMeLudusaviConfigDir appends ludusavi', () => {
  const win = getAchieveMeLudusaviConfigDir('C:\\Users\\x\\AppData\\Roaming\\achieveme')
  assert.match(win, /achieveme[/\\]ludusavi$/i)
  assert.ok(win.endsWith(`${path.sep}ludusavi`))
  assert.throws(() => getAchieveMeLudusaviConfigDir(''), /userData/)
})

test('withLudusaviConfig prepends --config', () => {
  assert.deepEqual(withLudusaviConfig('C:\\cfg', ['backup', '--api']), [
    '--config',
    'C:\\cfg',
    'backup',
    '--api'
  ])
  assert.deepEqual(withLudusaviConfig('', ['find', '--api']), ['find', '--api'])
})

test('buildCloudSetArgv maps providers', () => {
  assert.deepEqual(buildCloudSetArgv('google-drive'), ['cloud', 'set', 'google-drive'])
  assert.deepEqual(buildCloudSetArgv('onedrive'), ['cloud', 'set', 'onedrive'])
  assert.deepEqual(buildCloudSetArgv('dropbox'), ['cloud', 'set', 'dropbox'])
  assert.deepEqual(buildCloudSetArgv('box'), ['cloud', 'set', 'box'])
  assert.deepEqual(buildCloudSetArgv('none'), ['cloud', 'set', 'none'])
  assert.deepEqual(buildCloudSetArgv('custom', 'mydrive'), ['cloud', 'set', 'custom', 'mydrive'])
  assert.throws(() => buildCloudSetArgv('custom', '../evil'), /valid rclone remote/)
  assert.throws(() => buildCloudSetArgv('custom', ''), /valid rclone remote/)
})

test('isSafeRcloneRemoteId rejects path-like ids', () => {
  assert.equal(isSafeRcloneRemoteId('gdrive'), true)
  assert.equal(isSafeRcloneRemoteId('my_remote.1'), true)
  assert.equal(isSafeRcloneRemoteId(''), false)
  assert.equal(isSafeRcloneRemoteId('a:b'), false)
  assert.equal(isSafeRcloneRemoteId('a b'), false)
})

test('cloud upload/download argv', () => {
  assert.deepEqual(buildCloudUploadArgv(), ['cloud', 'upload', '--force', '--api'])
  assert.deepEqual(buildCloudDownloadArgv(), ['cloud', 'download', '--force', '--api'])
})

test('cloud conflict / sync failed detection', () => {
  assert.equal(hasLudusaviCloudConflict({ errors: { cloudConflict: {} } }), true)
  assert.equal(hasLudusaviCloudConflict({ errors: {} }), false)
  assert.equal(hasLudusaviCloudSyncFailed({ errors: { cloudSyncFailed: {} } }), true)
  assert.equal(
    ludusaviCloudSoftNoteFromApi({ errors: { cloudConflict: { x: 1 } } }),
    LUDUSAVI_CLOUD_CONFLICT_NOTE
  )
  assert.equal(
    ludusaviCloudSoftNoteFromApi({ errors: { cloudSyncFailed: { x: 1 } } }),
    LUDUSAVI_CLOUD_SYNC_FAILED_NOTE
  )
  assert.equal(ludusaviCloudSoftNoteFromApi({ errors: {} }), '')
})

test('parseCloudRemoteLabelFromConfigYaml', () => {
  assert.equal(
    parseCloudRemoteLabelFromConfigYaml('cloud:\n  remote:\n    GoogleDrive:\n      id: abc\n'),
    'Google Drive'
  )
  assert.equal(
    parseCloudRemoteLabelFromConfigYaml('cloud:\n  remote:\n    Dropbox:\n      id: x\n'),
    'Dropbox'
  )
  assert.equal(parseCloudRemoteLabelFromConfigYaml('cloud:\n  remote: ~\n'), null)
  assert.equal(parseCloudRemoteLabelFromConfigYaml(''), null)
})
