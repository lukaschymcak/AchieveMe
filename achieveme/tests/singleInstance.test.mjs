import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { shouldQuitForMissingInstanceLock } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/singleInstance.ts')).href
)

test('shouldQuitForMissingInstanceLock is true when lock was not acquired', () => {
  assert.equal(shouldQuitForMissingInstanceLock(false), true)
})

test('shouldQuitForMissingInstanceLock is false when lock was acquired', () => {
  assert.equal(shouldQuitForMissingInstanceLock(true), false)
})
