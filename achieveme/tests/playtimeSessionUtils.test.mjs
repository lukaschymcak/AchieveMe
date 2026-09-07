import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  flushDeltaSeconds,
  shouldPeriodicFlush,
  matchRunningGames,
  shouldOfferRecapOnOrphanClose,
  PLAYTIME_FLUSH_INTERVAL_MS
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/playtimeSessionUtils.ts')).href)

test('flushDeltaSeconds floors whole seconds and never goes negative', () => {
  assert.equal(flushDeltaSeconds(1000, 1000), 0)
  assert.equal(flushDeltaSeconds(1000, 2500), 1)
  assert.equal(flushDeltaSeconds(5000, 4000), 0)
  assert.equal(flushDeltaSeconds(0, 30_000), 30)
})

test('shouldPeriodicFlush uses 30s default interval', () => {
  assert.equal(shouldPeriodicFlush(0, PLAYTIME_FLUSH_INTERVAL_MS - 1), false)
  assert.equal(shouldPeriodicFlush(0, PLAYTIME_FLUSH_INTERVAL_MS), true)
})

test('matchRunningGames: launch_exe wins over under-root of another folder', () => {
  const processes = [
    { pid: 1, executablePath: 'D:\\Games\\A\\Game.exe' },
    { pid: 2, executablePath: 'D:\\Games\\B\\Game.exe' }
  ]
  const games = [
    {
      appid: '111',
      launchExe: 'D:\\Games\\B\\Game.exe',
      scanRoot: 'D:\\Games\\A'
    },
    {
      appid: '222',
      launchExe: '',
      scanRoot: 'D:\\Games\\B'
    }
  ]
  const matched = matchRunningGames(processes, games)
  assert.equal(matched.get('111')?.pid, 2)
  assert.equal(matched.has('222'), false)
})

test('matchRunningGames: registered PID wins over path match', () => {
  const processes = [
    { pid: 99, executablePath: 'D:\\Games\\A\\Game.exe' },
    { pid: 100, executablePath: 'D:\\Games\\B\\Other.exe' }
  ]
  const games = [
    {
      appid: '111',
      launchExe: 'D:\\Games\\A\\Game.exe',
      scanRoot: 'D:\\Games\\A'
    }
  ]
  const matched = matchRunningGames(processes, games, new Map([['111', 100]]))
  assert.equal(matched.get('111')?.pid, 100)
})

test('matchRunningGames: same basename different folders do not collide via launch_exe', () => {
  const processes = [{ pid: 5, executablePath: 'E:\\Only\\Configured\\Game.exe' }]
  const games = [
    { appid: '1', launchExe: '', scanRoot: 'E:\\Other\\Folder' },
    {
      appid: '2',
      launchExe: 'E:\\Only\\Configured\\Game.exe',
      scanRoot: 'E:\\Only\\Configured'
    }
  ]
  const matched = matchRunningGames(processes, games)
  assert.equal(matched.has('1'), false)
  assert.equal(matched.get('2')?.pid, 5)
})

test('matchRunningGames: ignores crash handlers under root', () => {
  const processes = [
    { pid: 7, executablePath: 'D:\\Games\\Title\\UnityCrashHandler64.exe' }
  ]
  const games = [
    { appid: '9', launchExe: '', scanRoot: 'D:\\Games\\Title' }
  ]
  assert.equal(matchRunningGames(processes, games).size, 0)
})

test('matchRunningGames: one process claims only the first matching game', () => {
  const processes = [{ pid: 3, executablePath: 'D:\\Shared\\Game.exe' }]
  const games = [
    { appid: 'a', launchExe: 'D:\\Shared\\Game.exe', scanRoot: 'D:\\Shared' },
    { appid: 'b', launchExe: 'D:\\Shared\\Game.exe', scanRoot: 'D:\\Shared' }
  ]
  const matched = matchRunningGames(processes, games)
  assert.equal(matched.size, 1)
  assert.equal(matched.get('a')?.pid, 3)
  assert.equal(matched.has('b'), false)
})

test('shouldOfferRecapOnOrphanClose is always false', () => {
  assert.equal(shouldOfferRecapOnOrphanClose(), false)
})
