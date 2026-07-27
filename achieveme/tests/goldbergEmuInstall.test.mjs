import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { resolveRegularEmuDllPath, installGoldbergEmuDll } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/goldbergFolderUtils.ts')).href
)

/**
 * @returns Temp release tree with regular/x64 and regular/x86 stub DLLs.
 */
function makeReleaseFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-emu-release-'))
  const x64Dir = path.join(tmp, 'regular', 'x64')
  const x86Dir = path.join(tmp, 'regular', 'x86')
  fs.mkdirSync(x64Dir, { recursive: true })
  fs.mkdirSync(x86Dir, { recursive: true })
  fs.writeFileSync(path.join(x64Dir, 'steam_api64.dll'), 'EMU64')
  fs.writeFileSync(path.join(x86Dir, 'steam_api.dll'), 'EMU86')
  return tmp
}

test('resolveRegularEmuDllPath points at regular arch DLL', () => {
  const root = path.join('C:', 'fake-release')
  assert.equal(
    resolveRegularEmuDllPath(root, 'x64'),
    path.join(path.resolve(root), 'regular', 'x64', 'steam_api64.dll')
  )
  assert.equal(
    resolveRegularEmuDllPath(root, 'x86'),
    path.join(path.resolve(root), 'regular', 'x86', 'steam_api.dll')
  )
})

test('installGoldbergEmuDll backs up and replaces x64 DLL', () => {
  const releaseRoot = makeReleaseFixture()
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-emu-game-'))
  const logs = []
  try {
    const dllPath = path.join(gameDir, 'steam_api64.dll')
    fs.writeFileSync(dllPath, 'ORIGINAL64')

    installGoldbergEmuDll({
      dllPath,
      architecture: 'x64',
      releaseRoot,
      log: (line) => logs.push(line)
    })

    assert.equal(fs.readFileSync(`${dllPath}.bak`, 'utf8'), 'ORIGINAL64')
    assert.equal(fs.readFileSync(dllPath, 'utf8'), 'EMU64')
    assert.ok(logs.some((l) => /Backing up/.test(l)))
    assert.ok(logs.some((l) => /Installing Goldberg/.test(l)))
  } finally {
    fs.rmSync(releaseRoot, { recursive: true, force: true })
    fs.rmSync(gameDir, { recursive: true, force: true })
  }
})

test('installGoldbergEmuDll overwrites existing .bak', () => {
  const releaseRoot = makeReleaseFixture()
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-emu-game-'))
  try {
    const dllPath = path.join(gameDir, 'steam_api.dll')
    fs.writeFileSync(dllPath, 'CURRENT')
    fs.writeFileSync(`${dllPath}.bak`, 'OLD_BAK')

    installGoldbergEmuDll({
      dllPath,
      architecture: 'x86',
      releaseRoot
    })

    assert.equal(fs.readFileSync(`${dllPath}.bak`, 'utf8'), 'CURRENT')
    assert.equal(fs.readFileSync(dllPath, 'utf8'), 'EMU86')
  } finally {
    fs.rmSync(releaseRoot, { recursive: true, force: true })
    fs.rmSync(gameDir, { recursive: true, force: true })
  }
})

test('installGoldbergEmuDll throws when source emu DLL is missing', () => {
  const releaseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-emu-empty-'))
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-emu-game-'))
  try {
    const dllPath = path.join(gameDir, 'steam_api64.dll')
    fs.writeFileSync(dllPath, 'ORIGINAL')

    assert.throws(
      () =>
        installGoldbergEmuDll({
          dllPath,
          architecture: 'x64',
          releaseRoot
        }),
      /Goldberg regular emu DLL was not found/
    )
    assert.equal(fs.readFileSync(dllPath, 'utf8'), 'ORIGINAL')
    assert.equal(fs.existsSync(`${dllPath}.bak`), false)
  } finally {
    fs.rmSync(releaseRoot, { recursive: true, force: true })
    fs.rmSync(gameDir, { recursive: true, force: true })
  }
})
