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
  LAUNCH_NEEDS_EXE
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/gameLaunchUtils.ts')).href
)

test('listInstallExecutables returns top-level exes sorted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-launch-'))
  try {
    fs.writeFileSync(path.join(tmp, 'Zebra.exe'), 'x')
    fs.writeFileSync(path.join(tmp, 'Alpha.exe'), 'x')
    fs.writeFileSync(path.join(tmp, 'readme.txt'), 'x')
    fs.mkdirSync(path.join(tmp, 'sub'))
    fs.writeFileSync(path.join(tmp, 'sub', 'Nested.exe'), 'x')

    const list = listInstallExecutables(tmp)
    assert.deepEqual(
      list.map((e) => e.name),
      ['Alpha.exe', 'Zebra.exe']
    )
    assert.equal(list[0].absolutePath, path.join(tmp, 'Alpha.exe'))
    assert.equal(list[0].relativePath, 'Alpha.exe')
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
