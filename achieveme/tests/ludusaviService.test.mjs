import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { validateLudusaviPath, findTitleBySteamId, backupGame } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviService.ts')).href
)

test('validateLudusaviPath accepts ludusavi.exe file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-svc-'))
  const exe = path.join(dir, 'ludusavi.exe')
  fs.writeFileSync(exe, '')
  assert.equal(validateLudusaviPath(exe), path.resolve(exe))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('validateLudusaviPath accepts folder containing ludusavi.exe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-svc-'))
  const exe = path.join(dir, 'ludusavi.exe')
  fs.writeFileSync(exe, '')
  assert.equal(validateLudusaviPath(dir), path.resolve(exe))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('validateLudusaviPath rejects wrong exe name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-svc-'))
  const exe = path.join(dir, 'other.exe')
  fs.writeFileSync(exe, '')
  assert.throws(() => validateLudusaviPath(exe), /ludusavi\.exe/i)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('findTitleBySteamId uses injectable runner', async () => {
  const calls = []
  const title = await findTitleBySteamId('C:\\fake\\ludusavi.exe', '570', async (argv) => {
    calls.push(argv)
    return {
      code: 0,
      stdout: JSON.stringify({ games: { 'Dota 2': { score: 1 } } }),
      stderr: ''
    }
  })
  assert.equal(title, 'Dota 2')
  assert.deepEqual(calls[0], ['find', '--steam-id', '570', '--api'])
})

test('findTitleBySteamId returns null when no match', async () => {
  const title = await findTitleBySteamId('C:\\fake\\ludusavi.exe', '999', async () => ({
    code: 0,
    stdout: JSON.stringify({ games: {} }),
    stderr: ''
  }))
  assert.equal(title, null)
})

test('backupGame parses Processed result', async () => {
  const result = await backupGame('C:\\fake\\ludusavi.exe', 'Dota 2', async (argv) => {
    assert.deepEqual(argv, ['backup', '--force', '--api', '--no-cloud-sync', 'Dota 2'])
    return {
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            decision: 'Processed',
            files: { a: { bytes: 10, failed: false } },
            registry: {}
          }
        }
      }),
      stderr: ''
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.bytes, 10)
})

test('backupGame fails when stdout is blank', async () => {
  const result = await backupGame('C:\\fake\\ludusavi.exe', 'X', async () => ({
    code: 1,
    stdout: '',
    stderr: 'boom'
  }))
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /boom/)
})
