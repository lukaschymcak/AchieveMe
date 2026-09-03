import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  validateLudusaviPath,
  validateRclonePath,
  wrapLudusaviRunnerWithConfig,
  findTitleBySteamId,
  backupGame,
  restoreGame,
  listGameBackups
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviService.ts')).href
)

test('validateRclonePath accepts rclone.exe file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rclone-svc-'))
  const exe = path.join(dir, 'rclone.exe')
  fs.writeFileSync(exe, '')
  assert.equal(validateRclonePath(exe), path.resolve(exe))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('wrapLudusaviRunnerWithConfig prepends --config', async () => {
  const calls = []
  const wrapped = wrapLudusaviRunnerWithConfig(async (argv) => {
    calls.push(argv)
    return { code: 0, stdout: '{}', stderr: '' }
  }, 'C:\\achieve\\ludusavi')
  await wrapped(['find', '--api'])
  assert.deepEqual(calls[0], ['--config', 'C:\\achieve\\ludusavi', 'find', '--api'])
})

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
    assert.deepEqual(argv, [
      'backup',
      '--force',
      '--api',
      '--no-cloud-sync',
      '--full-limit',
      '5',
      'Dota 2'
    ])
    return {
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            decision: 'Processed',
            change: 'Different',
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
  assert.equal(result.change, 'Different')
})

test('backupGame reports change Same', async () => {
  const result = await backupGame('C:\\fake\\ludusavi.exe', 'Dota 2', async () => ({
    code: 0,
    stdout: JSON.stringify({
      games: {
        'Dota 2': {
          decision: 'Processed',
          change: 'Same',
          files: { a: { bytes: 10, failed: false } },
          registry: {}
        }
      }
    }),
    stderr: ''
  }))
  assert.equal(result.ok, true)
  assert.equal(result.change, 'Same')
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

test('restoreGame parses Processed result', async () => {
  const result = await restoreGame('C:\\fake\\ludusavi.exe', 'Dota 2', async (argv) => {
    assert.deepEqual(argv, ['restore', '--force', '--api', '--no-cloud-sync', 'Dota 2'])
    return {
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            decision: 'Processed',
            files: { a: { bytes: 5, failed: false } },
            registry: {}
          }
        }
      }),
      stderr: ''
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.bytes, 5)
})

test('restoreGame fails when stdout is blank', async () => {
  const result = await restoreGame('C:\\fake\\ludusavi.exe', 'X', async () => ({
    code: 1,
    stdout: '',
    stderr: 'restore failed'
  }))
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /restore failed/)
})

test('restoreGame passes --backup when id provided', async () => {
  const result = await restoreGame(
    'C:\\fake\\ludusavi.exe',
    'Dota 2',
    'snap-1',
    async (argv) => {
      assert.deepEqual(argv, [
        'restore',
        '--force',
        '--api',
        '--no-cloud-sync',
        '--backup',
        'snap-1',
        'Dota 2'
      ])
      return {
        code: 0,
        stdout: JSON.stringify({
          games: {
            'Dota 2': {
              decision: 'Processed',
              files: { a: { bytes: 1, failed: false } },
              registry: {}
            }
          }
        }),
        stderr: ''
      }
    }
  )
  assert.equal(result.ok, true)
})

test('restoreGame rejects unsafe backup id', async () => {
  const result = await restoreGame('C:\\fake\\ludusavi.exe', 'Dota 2', '../evil', async () => {
    throw new Error('should not run')
  })
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /invalid backup id/i)
})

test('listGameBackups returns newest five', async () => {
  const snaps = await listGameBackups('C:\\fake\\ludusavi.exe', 'Dota 2', async (argv) => {
    assert.deepEqual(argv, ['backups', '--api', 'Dota 2'])
    return {
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            backups: [
              { name: 'a', when: '2024-01-01T00:00:00Z' },
              { name: 'b', when: '2024-06-01T00:00:00Z' },
              { name: 'c', when: '2024-03-01T00:00:00Z' }
            ]
          }
        }
      }),
      stderr: ''
    }
  })
  assert.deepEqual(
    snaps.map((s) => s.id),
    ['b', 'c', 'a']
  )
})
