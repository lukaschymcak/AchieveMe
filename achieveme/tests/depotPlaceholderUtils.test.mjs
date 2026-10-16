import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { isZeroPlaceholderFile, isCorruptExecutable, removeZeroPlaceholderFiles } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/depotPlaceholderUtils.ts')).href
)

test('isZeroPlaceholderFile matches a preallocated file and keeps real bytes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-placeholder-'))
  try {
    const empty = path.join(tmp, 'game.exe')
    const real = path.join(tmp, 'steam_api64.dll')
    const headOnly = path.join(tmp, 'partial.bin')
    fs.writeFileSync(empty, Buffer.alloc(80_000))
    fs.writeFileSync(real, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]))
    const partial = Buffer.alloc(80_000)
    partial.write('data', 40_000)
    fs.writeFileSync(headOnly, partial)
    assert.equal(isZeroPlaceholderFile(empty), true)
    assert.equal(isZeroPlaceholderFile(real), false)
    assert.equal(isZeroPlaceholderFile(headOnly), false)
    assert.equal(isZeroPlaceholderFile(path.join(tmp, 'missing.bin')), false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('isCorruptExecutable catches a DLL whose header was never written', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-placeholder-'))
  try {
    const broken = path.join(tmp, 'nvngx_dlss.dll')
    const good = path.join(tmp, 'steam_api64.dll')
    const blob = Buffer.alloc(80_000)
    blob.write('payload', 40_000)
    fs.writeFileSync(broken, blob)
    fs.writeFileSync(good, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]))
    fs.writeFileSync(path.join(tmp, 'pack.bin'), blob)
    assert.equal(isCorruptExecutable(broken), true)
    assert.equal(isCorruptExecutable(good), false)
    assert.equal(isZeroPlaceholderFile(broken), false)
    const removed = removeZeroPlaceholderFiles(tmp)
    assert.deepEqual(removed, [broken])
    assert.equal(fs.existsSync(good), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('removeZeroPlaceholderFiles deletes only empty placeholders', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-placeholder-'))
  try {
    const nested = path.join(tmp, 'data')
    fs.mkdirSync(nested)
    fs.writeFileSync(path.join(nested, 'pack.bin'), Buffer.alloc(70_000))
    fs.writeFileSync(path.join(tmp, 'game.exe'), Buffer.from('MZ'))
    fs.writeFileSync(path.join(tmp, 'note.txt'), '')
    const removed = removeZeroPlaceholderFiles(tmp)
    assert.deepEqual(removed, [path.join(nested, 'pack.bin')])
    assert.equal(fs.existsSync(path.join(tmp, 'game.exe')), true)
    assert.equal(fs.existsSync(path.join(tmp, 'note.txt')), true)
    assert.equal(fs.existsSync(path.join(nested, 'pack.bin')), false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
