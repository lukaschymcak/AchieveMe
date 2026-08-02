import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  validateSteamlessFolder,
  expectedUnpackedPath,
  resolveSteamlessCliPath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/steamlessService.ts')).href
)

test('validateSteamlessFolder accepts folder with CLI and Plugins', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-steamless-'))
  try {
    fs.writeFileSync(path.join(tmp, 'Steamless.CLI.exe'), 'x')
    fs.mkdirSync(path.join(tmp, 'Plugins'))
    assert.equal(validateSteamlessFolder(tmp), path.resolve(tmp))
    assert.equal(resolveSteamlessCliPath(tmp), path.join(path.resolve(tmp), 'Steamless.CLI.exe'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('validateSteamlessFolder rejects missing CLI', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-steamless-'))
  try {
    fs.mkdirSync(path.join(tmp, 'Plugins'))
    assert.throws(() => validateSteamlessFolder(tmp), /Steamless\.CLI\.exe/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('validateSteamlessFolder rejects missing Plugins', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-steamless-'))
  try {
    fs.writeFileSync(path.join(tmp, 'Steamless.CLI.exe'), 'x')
    assert.throws(() => validateSteamlessFolder(tmp), /Plugins/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('expectedUnpackedPath appends .unpacked.exe', () => {
  const exe = path.join('C:', 'Games', 'Game.exe')
  assert.equal(expectedUnpackedPath(exe), `${path.resolve(exe)}.unpacked.exe`)
})
