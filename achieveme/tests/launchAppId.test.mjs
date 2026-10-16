import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { LAUNCH_APPID_ARG, readIncomingLaunchAppId, readLaunchAppId } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/launchAppId.ts')).href
)

test('readLaunchAppId returns the numeric id after the flag', () => {
  assert.equal(
    readLaunchAppId(['AchieveMe.exe', LAUNCH_APPID_ARG, '2054970']),
    '2054970'
  )
})

test('readIncomingLaunchAppId prefers the single-instance payload', () => {
  assert.equal(readIncomingLaunchAppId({ launchAppId: '2054970' }, []), '2054970')
  assert.equal(
    readIncomingLaunchAppId(null, ['AchieveMe.exe', LAUNCH_APPID_ARG, '1086940']),
    '1086940'
  )
})

test('readLaunchAppId finds the id when Electron inserts switches after the flag', () => {
  assert.equal(
    readLaunchAppId([
      'electron.exe',
      LAUNCH_APPID_ARG,
      '--allow-file-access-from-files',
      'C:\\AchieveMe\\achieveme',
      '2054970'
    ]),
    '2054970'
  )
})

test('readLaunchAppId returns null when the flag is absent or the id is not numeric', () => {
  assert.equal(readLaunchAppId(['AchieveMe.exe']), null)
  assert.equal(readLaunchAppId(['AchieveMe.exe', LAUNCH_APPID_ARG]), null)
  assert.equal(readLaunchAppId(['AchieveMe.exe', LAUNCH_APPID_ARG, 'dd2']), null)
})
