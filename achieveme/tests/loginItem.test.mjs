import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  HIDDEN_LAUNCH_ARG,
  shouldStartHidden,
  buildLoginItemOptions,
  isPortableFromEnv,
  loginItemsSupported,
  resolveLoginItemOptions
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/loginItemUtils.ts')).href)

test('shouldStartHidden is true when argv includes --hidden', () => {
  assert.equal(shouldStartHidden(['electron', '.', HIDDEN_LAUNCH_ARG]), true)
})

test('shouldStartHidden is false without --hidden', () => {
  assert.equal(shouldStartHidden(['electron', '.']), false)
})

test('shouldStartHidden requires the exact --hidden token', () => {
  assert.equal(shouldStartHidden(['C:\\app--hidden.exe']), false)
})

test('buildLoginItemOptions disables login item when openAtLogin is false', () => {
  assert.deepEqual(
    buildLoginItemOptions({ openAtLogin: false, startMinimizedToTray: true }),
    { openAtLogin: false, args: [] }
  )
})

test('buildLoginItemOptions enables login without hidden args when minimize is off', () => {
  assert.deepEqual(
    buildLoginItemOptions({ openAtLogin: true, startMinimizedToTray: false }),
    { openAtLogin: true, args: [] }
  )
})

test('buildLoginItemOptions adds --hidden when both flags are on', () => {
  assert.deepEqual(
    buildLoginItemOptions({ openAtLogin: true, startMinimizedToTray: true }),
    { openAtLogin: true, args: [HIDDEN_LAUNCH_ARG] }
  )
})

test('isPortableFromEnv is false when PORTABLE_EXECUTABLE_DIR is missing', () => {
  assert.equal(isPortableFromEnv({}), false)
})

test('isPortableFromEnv is true when PORTABLE_EXECUTABLE_DIR is set', () => {
  assert.equal(isPortableFromEnv({ PORTABLE_EXECUTABLE_DIR: 'C:\\p' }), true)
})

test('isPortableFromEnv is false when PORTABLE_EXECUTABLE_DIR is whitespace-only', () => {
  assert.equal(isPortableFromEnv({ PORTABLE_EXECUTABLE_DIR: '   ' }), false)
})

test('loginItemsSupported is true only for packaged non-portable', () => {
  assert.equal(loginItemsSupported({ isPackaged: true, isPortable: false }), true)
  assert.equal(loginItemsSupported({ isPackaged: true, isPortable: true }), false)
  assert.equal(loginItemsSupported({ isPackaged: false, isPortable: false }), false)
  assert.equal(loginItemsSupported({ isPackaged: false, isPortable: true }), false)
})

test('resolveLoginItemOptions clears OS login when runtime is unsupported', () => {
  assert.deepEqual(
    resolveLoginItemOptions(
      { openAtLogin: true, startMinimizedToTray: true },
      { isPackaged: false, isPortable: false }
    ),
    { openAtLogin: false, args: [] }
  )
  assert.deepEqual(
    resolveLoginItemOptions(
      { openAtLogin: true, startMinimizedToTray: true },
      { isPackaged: true, isPortable: true }
    ),
    { openAtLogin: false, args: [] }
  )
})

test('resolveLoginItemOptions applies settings for installed NSIS runtime', () => {
  assert.deepEqual(
    resolveLoginItemOptions(
      { openAtLogin: true, startMinimizedToTray: true },
      { isPackaged: true, isPortable: false }
    ),
    { openAtLogin: true, args: [HIDDEN_LAUNCH_ARG] }
  )
})
