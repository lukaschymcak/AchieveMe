import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  isBlacklistedLaunchExe,
  rankGameExecutables,
  tokenizeLaunchArgs,
  scoreExecutableAgainstGame
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/gameExecutableRanking.ts')).href)

test('isBlacklistedLaunchExe catches crash handlers and redistributables', () => {
  assert.equal(isBlacklistedLaunchExe('UnityCrashHandler64.exe'), true)
  assert.equal(isBlacklistedLaunchExe('CrashReportClient.exe'), true)
  assert.equal(isBlacklistedLaunchExe('EasyAntiCheat_EOS.exe'), true)
  assert.equal(isBlacklistedLaunchExe('VC_redist.x64.exe'), true)
  assert.equal(isBlacklistedLaunchExe('DXSETUP.exe'), true)
  assert.equal(isBlacklistedLaunchExe('unins000.exe'), true)
  assert.equal(isBlacklistedLaunchExe('EldenRing.exe'), false)
  assert.equal(isBlacklistedLaunchExe('Game.exe'), false)
})

test('isBlacklistedLaunchExe uses basename from a full path', () => {
  assert.equal(isBlacklistedLaunchExe('D:\\Games\\Foo\\Engine\\UnityCrashHandler64.exe'), true)
  assert.equal(isBlacklistedLaunchExe('D:\\Games\\Foo\\Foo.exe'), false)
})

test('rankGameExecutables puts title-like exe above crash handler', () => {
  const ranked = rankGameExecutables(
    [
      {
        name: 'UnityCrashHandler64.exe',
        relativePath: 'Engine/UnityCrashHandler64.exe',
        absolutePath: 'D:\\Games\\Elden Ring\\Engine\\UnityCrashHandler64.exe'
      },
      {
        name: 'EldenRing.exe',
        relativePath: 'EldenRing.exe',
        absolutePath: 'D:\\Games\\Elden Ring\\EldenRing.exe'
      },
      {
        name: 'setup.exe',
        relativePath: '_commonredist/setup.exe',
        absolutePath: 'D:\\Games\\Elden Ring\\_commonredist\\setup.exe'
      }
    ],
    'Elden Ring'
  )

  assert.equal(ranked[0].name, 'EldenRing.exe')
  assert.equal(ranked[0].suggested, true)
  assert.ok(ranked.some((e) => e.name === 'UnityCrashHandler64.exe' && e.suggested === false))
  assert.ok(ranked.every((e) => typeof e.suggested === 'boolean'))
  const suggested = ranked.filter((e) => e.suggested)
  assert.ok(suggested.every((e) => !isBlacklistedLaunchExe(e.name)))
  assert.equal(suggested[0].name, 'EldenRing.exe')
})

test('rankGameExecutables never lists blacklisted as suggested', () => {
  const ranked = rankGameExecutables(
    [
      {
        name: 'UnityCrashHandler64.exe',
        relativePath: 'UnityCrashHandler64.exe',
        absolutePath: 'C:\\g\\UnityCrashHandler64.exe'
      },
      {
        name: 'vcredist_x64.exe',
        relativePath: 'redist/vcredist_x64.exe',
        absolutePath: 'C:\\g\\redist\\vcredist_x64.exe'
      }
    ],
    'Some Game'
  )
  assert.ok(ranked.every((e) => e.suggested === false))
})

test('scoreExecutableAgainstGame prefers name overlap', () => {
  const high = scoreExecutableAgainstGame('EldenRing.exe', 'Elden Ring', 'EldenRing.exe')
  const low = scoreExecutableAgainstGame('Launcher.exe', 'Elden Ring', 'tools/Launcher.exe')
  assert.ok(high > low)
})

test('tokenizeLaunchArgs splits whitespace and keeps quoted groups', () => {
  assert.deepEqual(tokenizeLaunchArgs(''), [])
  assert.deepEqual(tokenizeLaunchArgs('   '), [])
  assert.deepEqual(tokenizeLaunchArgs('-windowed -w 1280'), ['-windowed', '-w', '1280'])
  assert.deepEqual(tokenizeLaunchArgs('-map "My Map" -easy'), ['-map', 'My Map', '-easy'])
  assert.deepEqual(tokenizeLaunchArgs('"-only quoted"'), ['-only quoted'])
})
