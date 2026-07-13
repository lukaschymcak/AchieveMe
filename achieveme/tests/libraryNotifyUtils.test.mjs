import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { buildLibraryUpdatedPayload } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/libraryNotifyUtils.ts')).href
)

test('buildLibraryUpdatedPayload returns single appid when only one is queued', () => {
  assert.deepEqual(buildLibraryUpdatedPayload(['123456']), { appid: '123456' })
})

test('buildLibraryUpdatedPayload returns empty payload for generic refresh', () => {
  assert.deepEqual(buildLibraryUpdatedPayload([null]), {})
})

test('buildLibraryUpdatedPayload returns empty payload when multiple appids are queued', () => {
  assert.deepEqual(buildLibraryUpdatedPayload(['111', '222']), {})
})

test('buildLibraryUpdatedPayload returns empty payload when generic and specific are mixed', () => {
  assert.deepEqual(buildLibraryUpdatedPayload(['111', null]), {})
})
