import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  HIDDEN_LAUNCH_ARG,
  shouldStartHidden,
  buildLoginItemOptions
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/loginItemUtils.ts')).href)

test('shouldStartHidden is true when argv includes --hidden', () => {
  assert.equal(shouldStartHidden(['electron', '.', HIDDEN_LAUNCH_ARG]), true)
})

test('shouldStartHidden is false without --hidden', () => {
  assert.equal(shouldStartHidden(['electron', '.']), false)
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
