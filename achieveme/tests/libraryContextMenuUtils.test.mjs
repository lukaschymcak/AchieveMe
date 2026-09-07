import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  resolveLibraryOpenFolder,
  shouldShowOpenFolder,
  playMenuLabel,
  normalizeOpenableAbsolutePath,
  dirnameOfPath
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/libraryContextMenuUtils.ts')).href)

test('resolveLibraryOpenFolder prefers install_path', () => {
  assert.equal(
    resolveLibraryOpenFolder('D:\\Games\\Elden Ring', 'D:\\Games\\Elden Ring\\Game.exe'),
    'D:\\Games\\Elden Ring'
  )
})

test('resolveLibraryOpenFolder falls back to dirname of launch_exe', () => {
  assert.equal(
    resolveLibraryOpenFolder('', 'D:\\Games\\Foo\\bin\\Game.exe'),
    'D:\\Games\\Foo\\bin'
  )
  assert.equal(resolveLibraryOpenFolder('   ', 'C:/Games/Bar/Game.exe'), 'C:\\Games\\Bar')
})

test('resolveLibraryOpenFolder returns null when both empty', () => {
  assert.equal(resolveLibraryOpenFolder('', ''), null)
  assert.equal(resolveLibraryOpenFolder('  ', '  '), null)
})

test('shouldShowOpenFolder mirrors resolve', () => {
  assert.equal(shouldShowOpenFolder('D:\\Games\\A', ''), true)
  assert.equal(shouldShowOpenFolder('', 'D:\\Games\\A\\a.exe'), true)
  assert.equal(shouldShowOpenFolder('', ''), false)
})

test('playMenuLabel covers play states', () => {
  assert.equal(playMenuLabel(true, false), 'Play')
  assert.equal(playMenuLabel(true, true), 'Starting…')
  assert.equal(playMenuLabel(false, false), 'Set up Play')
  assert.equal(playMenuLabel(false, true), 'Starting…')
})

test('normalizeOpenableAbsolutePath accepts Windows absolute paths', () => {
  assert.equal(normalizeOpenableAbsolutePath('D:\\Games\\Foo'), 'D:\\Games\\Foo')
  assert.equal(normalizeOpenableAbsolutePath('D:/Games/Foo/'), 'D:\\Games\\Foo')
  assert.equal(normalizeOpenableAbsolutePath(''), null)
  assert.equal(normalizeOpenableAbsolutePath('Games\\Foo'), null)
  assert.equal(normalizeOpenableAbsolutePath('../etc'), null)
})

test('dirnameOfPath handles mixed separators', () => {
  assert.equal(dirnameOfPath('D:\\a\\b\\c.exe'), 'D:\\a\\b')
  assert.equal(dirnameOfPath('D:/a/b.exe'), 'D:\\a')
})
