import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  parseSteamAppIdTxt,
  isRefusedScanRoot,
  shouldSkipScanDirName,
  proposeInstallScanRoots,
  guessNameFromInstallPath,
  dedupeScanCandidates,
  isNumericAppIdFolderName,
  isSteamApiDllFileName
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/installedGamesScanUtils.ts')).href)

test('parseSteamAppIdTxt accepts first numeric line', () => {
  assert.equal(parseSteamAppIdTxt('1245620\n'), '1245620')
  assert.equal(parseSteamAppIdTxt('\uFEFF570\r\n'), '570')
  assert.equal(parseSteamAppIdTxt('  440  '), '440')
  assert.equal(parseSteamAppIdTxt(''), null)
  assert.equal(parseSteamAppIdTxt('not-a-number'), null)
  assert.equal(parseSteamAppIdTxt('appid=570'), null)
})

test('isRefusedScanRoot blocks drive roots and Windows', () => {
  assert.equal(isRefusedScanRoot('C:\\'), true)
  assert.equal(isRefusedScanRoot('C:'), true)
  assert.equal(isRefusedScanRoot('C:\\Windows'), true)
  assert.equal(isRefusedScanRoot('D:/Windows'), true)
  assert.equal(isRefusedScanRoot('D:\\Games'), false)
  assert.equal(isRefusedScanRoot('F:\\SteamLibrary\\steamapps\\common'), false)
  assert.equal(isRefusedScanRoot(''), true)
})

test('shouldSkipScanDirName matches skip list case-insensitively', () => {
  assert.equal(shouldSkipScanDirName('node_modules'), true)
  assert.equal(shouldSkipScanDirName('Windows'), true)
  assert.equal(shouldSkipScanDirName('$Recycle.Bin'), true)
  assert.equal(shouldSkipScanDirName('.git'), true)
  assert.equal(shouldSkipScanDirName('System Volume Information'), true)
  assert.equal(shouldSkipScanDirName('MyGame'), false)
})

test('proposeInstallScanRoots returns only existing non-refused paths', () => {
  const exists = new Set(['D:\\Games', 'C:\\Windows', 'E:\\Games'])
  const roots = proposeInstallScanRoots(
    (p) => exists.has(p),
    ['C:\\Windows', 'F:\\SteamLibrary\\steamapps\\common']
  )
  assert.deepEqual(roots, ['D:\\Games', 'E:\\Games'])
})

test('proposeInstallScanRoots includes existing Steam common', () => {
  const exists = new Set(['F:\\SteamLibrary\\steamapps\\common'])
  const roots = proposeInstallScanRoots((p) => exists.has(p), [
    'F:\\SteamLibrary\\steamapps\\common'
  ])
  assert.deepEqual(roots, ['F:\\SteamLibrary\\steamapps\\common'])
})

test('guessNameFromInstallPath prefers parent for numeric appid folders', () => {
  assert.equal(guessNameFromInstallPath('D:\\Games\\EldenRing', '1245620'), 'EldenRing')
  assert.equal(
    guessNameFromInstallPath('D:\\Games\\EldenRing\\1245620', '1245620'),
    'EldenRing'
  )
})

test('dedupeScanCandidates keeps first appid', () => {
  const out = dedupeScanCandidates([
    { appid: '1', installPath: 'A' },
    { appid: '1', installPath: 'B' },
    { appid: '2', installPath: 'C' }
  ])
  assert.deepEqual(out, [
    { appid: '1', installPath: 'A' },
    { appid: '2', installPath: 'C' }
  ])
})

test('dll and numeric folder helpers', () => {
  assert.equal(isNumericAppIdFolderName('570'), true)
  assert.equal(isNumericAppIdFolderName('Game'), false)
  assert.equal(isSteamApiDllFileName('steam_api64.dll'), true)
  assert.equal(isSteamApiDllFileName('steam_api.dll'), true)
  assert.equal(isSteamApiDllFileName('GameAssembly.dll'), false)
})
