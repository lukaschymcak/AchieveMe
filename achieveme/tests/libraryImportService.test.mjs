import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { validateImportExistingInstall } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/libraryImportUtils.ts')).href
)

test('validateImportExistingInstall rejects bad appid', () => {
  assert.match(
    validateImportExistingInstall({
      appid: 'abc',
      installPath: 'D:\\Games\\Foo',
      gids: { '1': 'g' },
      pathExists: true,
      isDirectory: true
    }) ?? '',
    /AppID/i
  )
})

test('validateImportExistingInstall rejects missing path', () => {
  assert.match(
    validateImportExistingInstall({
      appid: '570',
      installPath: 'D:\\missing',
      gids: { '1': 'g' },
      pathExists: false,
      isDirectory: false
    }) ?? '',
    /exist|folder|path/i
  )
})

test('validateImportExistingInstall rejects file that is not a directory', () => {
  assert.match(
    validateImportExistingInstall({
      appid: '570',
      installPath: 'D:\\Games\\Foo.exe',
      gids: { '1': 'g' },
      pathExists: true,
      isDirectory: false
    }) ?? '',
    /directory/i
  )
})

test('validateImportExistingInstall rejects empty gids', () => {
  assert.equal(
    validateImportExistingInstall({
      appid: '570',
      installPath: 'D:\\Games\\Foo',
      gids: {},
      pathExists: true,
      isDirectory: true
    }),
    'Select at least one depot with a manifest GID.'
  )
})

test('validateImportExistingInstall returns null for happy path', () => {
  assert.equal(
    validateImportExistingInstall({
      appid: '570',
      installPath: 'D:\\Games\\Foo',
      gids: { '571': 'gid-a' },
      pathExists: true,
      isDirectory: true
    }),
    null
  )
})
