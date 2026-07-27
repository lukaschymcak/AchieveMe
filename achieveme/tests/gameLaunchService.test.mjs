import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  listInstallExecutables,
  listExeBaseNamesForPlaytime,
  launchGameExe,
  LAUNCH_NEEDS_EXE,
  classifyFolderNameMatch,
  resolveGameRoot,
  isAcronymSubsequence,
  significantNameTokens
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/gameLaunchUtils.ts')).href
)

test('listInstallExecutables finds nested exes with relative paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    fs.writeFileSync(path.join(tmp, 'Zebra.exe'), 'x')
    fs.writeFileSync(path.join(tmp, 'Alpha.exe'), 'x')
    fs.writeFileSync(path.join(tmp, 'readme.txt'), 'x')
    fs.mkdirSync(path.join(tmp, 'sub'))
    fs.writeFileSync(path.join(tmp, 'sub', 'Nested.exe'), 'x')

    const list = listInstallExecutables(tmp)
    assert.deepEqual(
      list.map((e) => e.relativePath.replace(/\\/g, '/')),
      ['Alpha.exe', 'sub/Nested.exe', 'Zebra.exe']
    )
    assert.equal(list[0].absolutePath, path.join(tmp, 'Alpha.exe'))
    assert.equal(list.find((e) => e.name === 'Nested.exe').relativePath.replace(/\\/g, '/'), 'sub/Nested.exe')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('listInstallExecutables returns empty for missing folder', () => {
  assert.deepEqual(listInstallExecutables(path.join(os.tmpdir(), 'no-such-game-dir-xyz')), [])
})

test('listExeBaseNamesForPlaytime strips extension and lowercases', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    fs.writeFileSync(path.join(tmp, 'Game.EXE'), 'x')
    assert.deepEqual(listExeBaseNamesForPlaytime(tmp), ['game'])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('listExeBaseNamesForPlaytime climbs to confident game root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const gameRoot = path.join(tmp, 'DragonSword  Awakening')
    const dllDir = path.join(
      gameRoot,
      'Engine',
      'Binaries',
      'ThirdParty',
      'Steamworks',
      'Steamv153',
      'Win64'
    )
    fs.mkdirSync(dllDir, { recursive: true })
    fs.writeFileSync(path.join(gameRoot, 'DSClient.exe'), 'x')
    fs.mkdirSync(path.join(gameRoot, 'DS', 'Binaries', 'Win64'), { recursive: true })
    fs.writeFileSync(
      path.join(gameRoot, 'DS', 'Binaries', 'Win64', 'DSClient-Win64-Shipping.exe'),
      'x'
    )

    const names = listExeBaseNamesForPlaytime(dllDir, 'DragonSword : Awakening')
    assert.ok(names.includes('dsclient'))
    assert.ok(names.includes('dsclient-win64-shipping'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('launchGameExe throws when file is missing', () => {
  assert.throws(
    () => launchGameExe(path.join(os.tmpdir(), 'missing-game-xyz.exe')),
    /not found/
  )
})

test('launchGameExe throws when path is not an exe', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const file = path.join(tmp, 'note.txt')
    fs.writeFileSync(file, 'x')
    assert.throws(() => launchGameExe(file), /\.exe/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('LAUNCH_NEEDS_EXE code is stable for UI handling', () => {
  assert.equal(LAUNCH_NEEDS_EXE, 'LAUNCH_NEEDS_EXE')
})

test('classifyFolderNameMatch is confident for DragonSword-style names', () => {
  assert.equal(
    classifyFolderNameMatch('DragonSword  Awakening', 'DragonSword : Awakening'),
    'confident'
  )
})

test('classifyFolderNameMatch is unsure for P5X acronym', () => {
  assert.equal(
    classifyFolderNameMatch('P5X', 'Persona 5: The Phantom X'),
    'unsure'
  )
})

test('classifyFolderNameMatch ignores unrelated deep folders', () => {
  assert.equal(classifyFolderNameMatch('Win64', 'DragonSword : Awakening'), 'none')
  assert.equal(classifyFolderNameMatch('Steamworks', 'DragonSword : Awakening'), 'none')
})

test('isAcronymSubsequence matches P5X against persona tokens', () => {
  const tokens = significantNameTokens('Persona 5: The Phantom X')
  assert.equal(isAcronymSubsequence('p5x', tokens), true)
})

test('resolveGameRoot finds DragonSword root from deep DLL path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-root-'))
  try {
    const gameRoot = path.join(tmp, 'DragonSword  Awakening')
    const dllDir = path.join(
      gameRoot,
      'Engine',
      'Binaries',
      'ThirdParty',
      'Steamworks',
      'Steamv153',
      'Win64'
    )
    fs.mkdirSync(dllDir, { recursive: true })

    const result = resolveGameRoot(dllDir, 'DragonSword : Awakening')
    assert.equal(result.status, 'confident')
    assert.equal(result.root, gameRoot)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('resolveGameRoot returns unsure for acronym folder', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-root-'))
  try {
    const gameRoot = path.join(tmp, 'Games', 'P5X')
    const dllDir = path.join(gameRoot, 'Binaries', 'Win64')
    fs.mkdirSync(dllDir, { recursive: true })

    const result = resolveGameRoot(dllDir, 'Persona 5: The Phantom X')
    assert.equal(result.status, 'unsure')
    assert.equal(result.candidatePath, gameRoot)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('resolveGameRoot returns none when no name match exists', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-root-'))
  try {
    const dllDir = path.join(tmp, 'RandomInstall', 'Engine', 'Win64')
    fs.mkdirSync(dllDir, { recursive: true })
    const result = resolveGameRoot(dllDir, 'Some Unrelated Title XYZ')
    assert.equal(result.status, 'none')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
