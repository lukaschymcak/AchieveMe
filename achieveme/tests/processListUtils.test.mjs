import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseCimProcessList,
  normalizePathForMatch,
  pathsEqual,
  isPathUnderRoot,
  isIgnoredPlaytimeExe,
  exeBasenameNoExt
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/processListUtils.ts')).href)

test('parseCimProcessList parses tab-separated pid and path', () => {
  const text = [
    'ProcessId\tExecutablePath',
    '1234\tC:\\Games\\Title\\Game.exe',
    '56\t',
    '789\tD:\\Other\\App.exe'
  ].join('\n')
  assert.deepEqual(parseCimProcessList(text), [
    { pid: 1234, executablePath: 'C:\\Games\\Title\\Game.exe' },
    { pid: 789, executablePath: 'D:\\Other\\App.exe' }
  ])
})

test('parseCimProcessList parses comma-separated rows and skips bad pids', () => {
  const text = '10,C:\\a.exe\nnotanumber,C:\\b.exe\n20,"C:\\c path\\c.exe"'
  assert.deepEqual(parseCimProcessList(text), [
    { pid: 10, executablePath: 'C:\\a.exe' },
    { pid: 20, executablePath: 'C:\\c path\\c.exe' }
  ])
})

test('pathsEqual is case and slash insensitive', () => {
  assert.equal(pathsEqual('C:/Games/Game.exe', 'c:\\games\\game.exe'), true)
  assert.equal(pathsEqual('C:\\Games\\A.exe', 'C:\\Games\\B.exe'), false)
  assert.equal(pathsEqual('', 'C:\\a.exe'), false)
})

test('isPathUnderRoot matches root and nested files', () => {
  assert.equal(isPathUnderRoot('D:\\Games\\Title\\Game.exe', 'D:\\Games\\Title'), true)
  assert.equal(isPathUnderRoot('D:\\Games\\Title', 'D:\\Games\\Title'), true)
  assert.equal(isPathUnderRoot('D:\\Games\\Other\\Game.exe', 'D:\\Games\\Title'), false)
})

test('isIgnoredPlaytimeExe covers tools and crash handlers', () => {
  assert.equal(isIgnoredPlaytimeExe('C:\\Apps\\AchieveMe.exe'), true)
  assert.equal(isIgnoredPlaytimeExe('C:\\Games\\Title\\UnityCrashHandler64.exe'), true)
  assert.equal(isIgnoredPlaytimeExe('C:\\Games\\Title\\Game.exe'), false)
  assert.equal(exeBasenameNoExt('C:\\x\\DOTNET.EXE'), 'dotnet')
})

test('normalizePathForMatch strips trailing slashes', () => {
  assert.equal(normalizePathForMatch('C:\\Games\\Title\\'), 'c:\\games\\title')
})
