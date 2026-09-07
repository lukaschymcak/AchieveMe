import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  listInstallExecutables,
  listExeBaseNamesForPlaytime,
  launchGameExe,
  formatSpawnLaunchError,
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
    const paths = list.map((e) => e.relativePath.replace(/\\/g, '/'))
    assert.ok(paths.includes('Alpha.exe'))
    assert.ok(paths.includes('Zebra.exe'))
    assert.ok(paths.includes('sub/Nested.exe'))
    assert.equal(list.length, 3)
    assert.equal(list.find((e) => e.name === 'Nested.exe')?.relativePath.replace(/\\/g, '/'), 'sub/Nested.exe')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('listInstallExecutables ranks title exe above crash handler', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    fs.writeFileSync(path.join(tmp, 'UnityCrashHandler64.exe'), 'x')
    fs.writeFileSync(path.join(tmp, 'EldenRing.exe'), 'x')
    const list = listInstallExecutables(tmp, 'Elden Ring')
    assert.equal(list[0].name, 'EldenRing.exe')
    assert.equal(list[0].suggested, true)
    const crash = list.find((e) => e.name === 'UnityCrashHandler64.exe')
    assert.equal(crash?.suggested, false)
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

test('launchGameExe throws when file is missing', async () => {
  await assert.rejects(
    () => launchGameExe(path.join(os.tmpdir(), 'missing-game-xyz.exe')),
    /not found/
  )
})

test('launchGameExe throws when path is not an exe', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const file = path.join(tmp, 'note.txt')
    fs.writeFileSync(file, 'x')
    await assert.rejects(() => launchGameExe(file), /\.exe/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('launchGameExe spawn-first returns pid and passes args', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const exe = path.join(tmp, 'Game.exe')
    fs.writeFileSync(exe, 'x')
    let seenArgs
    let seenFile
    const result = await launchGameExe(exe, {
      args: ['-windowed'],
      spawnImpl: (file, args) => {
        seenFile = file
        seenArgs = args
        const child = new EventEmitter()
        child.pid = 4242
        child.unref = () => {}
        queueMicrotask(() => child.emit('spawn'))
        return child
      }
    })
    assert.equal(seenFile, path.resolve(exe))
    assert.deepEqual(seenArgs, ['-windowed'])
    assert.equal(result.pid, 4242)
    assert.equal(result.usedOpenPath, false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('launchGameExe falls back to openPath on EACCES', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const exe = path.join(tmp, 'Game.exe')
    fs.writeFileSync(exe, 'x')
    let openPathSeen = ''
    const result = await launchGameExe(exe, {
      args: ['-ignored'],
      openPath: async (p) => {
        openPathSeen = p
        return ''
      },
      spawnImpl: () => {
        const child = new EventEmitter()
        child.pid = undefined
        child.unref = () => {}
        queueMicrotask(() =>
          child.emit('error', Object.assign(new Error('spawn EACCES'), { code: 'EACCES' }))
        )
        return child
      }
    })
    assert.equal(openPathSeen, path.resolve(exe))
    assert.equal(result.usedOpenPath, true)
    assert.equal(result.pid, undefined)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('launchGameExe rejects when openPath returns an error string after EACCES', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    const exe = path.join(tmp, 'Game.exe')
    fs.writeFileSync(exe, 'x')
    await assert.rejects(
      () =>
        launchGameExe(exe, {
          openPath: async () => 'Failed to open',
          spawnImpl: () => {
            const child = new EventEmitter()
            child.unref = () => {}
            queueMicrotask(() =>
              child.emit('error', Object.assign(new Error('spawn EACCES'), { code: 'EACCES' }))
            )
            return child
          }
        }),
      /Failed to open/
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('formatSpawnLaunchError explains EACCES / run as administrator', () => {
  const msg = formatSpawnLaunchError(
    'F:\\Games\\START_ONIMUSHA.exe',
    Object.assign(new Error('spawn EACCES'), { code: 'EACCES' })
  )
  assert.match(msg, /EACCES|administrator/i)
  assert.match(msg, /START_ONIMUSHA\.exe/)
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

test('classifyFolderNameMatch is unsure for Unity _Data subfolder (not confident)', () => {
  assert.equal(classifyFolderNameMatch('Unpacking_Data', 'Unpacking'), 'unsure')
  assert.equal(classifyFolderNameMatch('Hades_Data', 'Hades'), 'unsure')
  assert.equal(classifyFolderNameMatch('GameName_Data', 'Game Name'), 'unsure')
})

test('classifyFolderNameMatch is confident for exact game root folder', () => {
  assert.equal(classifyFolderNameMatch('Unpacking', 'Unpacking'), 'confident')
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

test('resolveGameRoot climbs past Unity _Data to game root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-root-'))
  try {
    const gameRoot = path.join(tmp, 'Unpacking')
    const dataDir = path.join(gameRoot, 'Unpacking_Data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(gameRoot, 'Unpacking.exe'), 'x')

    const result = resolveGameRoot(dataDir, 'Unpacking')
    assert.equal(result.status, 'confident')
    assert.equal(result.root, gameRoot)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
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
