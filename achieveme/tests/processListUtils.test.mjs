import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseProcessList,
  formatProcessListError,
  normalizePathForMatch,
  pathsEqual,
  isPathUnderRoot,
  isIgnoredPlaytimeExe,
  exeBasenameNoExt
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/processListUtils.ts')).href)

test('parseProcessList parses tab-separated pid and path', () => {
  const text = [
    'ProcessId\tExecutablePath',
    '1234\tC:\\Games\\Title\\Game.exe',
    '56\t',
    '789\tD:\\Other\\App.exe'
  ].join('\n')
  assert.deepEqual(parseProcessList(text), [
    { pid: 1234, name: 'game', executablePath: 'C:\\Games\\Title\\Game.exe' },
    { pid: 56, name: '', executablePath: '' },
    { pid: 789, name: 'app', executablePath: 'D:\\Other\\App.exe' }
  ])
})

test('parseProcessList parses pid, process name, and optional path', () => {
  const text = ['22340\tDawnWalker\t', '8\tGame\tC:\\Games\\Game.exe'].join('\n')
  assert.deepEqual(parseProcessList(text), [
    { pid: 22340, name: 'dawnwalker', executablePath: '' },
    { pid: 8, name: 'game', executablePath: 'C:\\Games\\Game.exe' }
  ])
})

test('parseProcessList parses literal backtick-t delimited output', () => {
  const text = ['22340`tDawnWalker`t', '8`tGame`tC:\\Games\\Game.exe'].join('\n')
  assert.deepEqual(parseProcessList(text), [
    { pid: 22340, name: 'dawnwalker', executablePath: '' },
    { pid: 8, name: 'game', executablePath: 'C:\\Games\\Game.exe' }
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

test('formatProcessListError labels a killed exec as timeout', () => {
  const err = Object.assign(new Error('Command failed'), { killed: true })
  assert.equal(formatProcessListError(err), 'timeout')
})

test('formatProcessListError uses Error.message when present', () => {
  assert.equal(formatProcessListError(new Error('boom')), 'boom')
})
