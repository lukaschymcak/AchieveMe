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
  listGameBackups,
  setAchieveMeLudusaviConfigDir
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

test('backupGame always uses --no-cloud-sync', async () => {
  const calls = []
  await backupGame('C:\\fake\\ludusavi.exe', 'Dota 2', async (argv) => {
    calls.push(argv)
    return {
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            decision: 'Processed',
            change: 'Different',
            files: { a: { bytes: 1, failed: false } },
            registry: {}
          }
        }
      }),
      stderr: ''
    }
  })
  assert.ok(calls[0].includes('--no-cloud-sync'))
  assert.ok(!calls[0].includes('--cloud-sync'))
})

test('cloudSetProvider builds argv', async () => {
  const { cloudSetProvider, setAchieveMeLudusaviConfigDir } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviService.ts')).href
  )
  setAchieveMeLudusaviConfigDir('')
  const calls = []
  const result = await cloudSetProvider(
    'C:\\fake\\ludusavi.exe',
    'google-drive',
    undefined,
    async (argv) => {
      calls.push(argv)
      return { code: 0, stdout: '', stderr: '' }
    }
  )
  assert.equal(result.ok, true)
  assert.deepEqual(calls[0], ['cloud', 'set', 'google-drive'])
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

test('restoreGame routes cloud-* to restore --path via staging', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-cloud-restore-'))
  const configDir = path.join(base, 'cfg')
  const stagingRoot = path.join(base, 'staging')
  const gameDir = path.join(configDir, 'backup', 'Dota 2')
  const artifactId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const cloudId = `cloud-${artifactId}`
  const cloudDir = path.join(gameDir, cloudId)
  fs.mkdirSync(path.join(cloudDir, 'drive-C', 'Users', 'Public'), { recursive: true })
  fs.writeFileSync(path.join(cloudDir, 'drive-C', 'Users', 'Public', 'save.dat'), 'CLOUD')
  fs.writeFileSync(
    path.join(gameDir, 'mapping.yaml'),
    `---\nname: "Dota 2"\ndrives:\n  drive-C: "C:"\nbackups:\n  - name: backup-old\n    files: {}\n`
  )
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(configDir, 'backup').replace(/\\/g, '/')}\n`
  )
  setAchieveMeLudusaviConfigDir(configDir)

  try {
    const result = await restoreGame(
      'C:\\fake\\ludusavi.exe',
      'Dota 2',
      cloudId,
      async (argv) => {
        assert.ok(argv.includes('restore'))
        assert.ok(argv.includes('--path'))
        assert.ok(argv.includes('--backup'))
        assert.equal(argv[argv.indexOf('--backup') + 1], '.')
        const pathIdx = argv.indexOf('--path')
        assert.equal(path.resolve(argv[pathIdx + 1]), path.resolve(stagingRoot))
        assert.equal(argv[argv.length - 1], 'Dota 2')
        const staged = path.join(stagingRoot, 'Dota 2')
        const mapping = fs.readFileSync(path.join(staged, 'mapping.yaml'), 'utf8')
        assert.match(mapping, /name: "\."/)
        assert.match(mapping, /C:\/Users\/Public\/save\.dat/)
        assert.ok(fs.existsSync(path.join(staged, 'drive-C', 'Users', 'Public', 'save.dat')))
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
      },
      { configDir, stagingRoot }
    )
    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(path.join(stagingRoot, 'Dota 2')), false)
  } finally {
    setAchieveMeLudusaviConfigDir('')
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('restoreGame cloud-* normalizes mapping when cloud folder lacks it', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-cloud-merge-map-'))
  const configDir = path.join(base, 'cfg')
  const stagingRoot = path.join(base, 'staging')
  const gameDir = path.join(configDir, 'backup', 'Dota 2')
  const cloudId = 'cloud-cccccccccccccccccccccccccccccccc'
  fs.mkdirSync(path.join(gameDir, cloudId, 'drive-C'), { recursive: true })
  fs.writeFileSync(path.join(gameDir, cloudId, 'drive-C', 'save.dat'), 'CLOUD')
  fs.writeFileSync(
    path.join(gameDir, 'mapping.yaml'),
    `---\nname: "Dota 2"\ndrives:\n  drive-C: "C:"\n`
  )
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(configDir, 'backup').replace(/\\/g, '/')}\n`
  )
  setAchieveMeLudusaviConfigDir(configDir)

  try {
    const result = await restoreGame(
      'C:\\fake\\ludusavi.exe',
      'Dota 2',
      cloudId,
      async (argv) => {
        assert.ok(argv.includes('--path'))
        assert.equal(argv[argv.indexOf('--backup') + 1], '.')
        const staged = path.join(stagingRoot, 'Dota 2')
        const mapping = fs.readFileSync(path.join(staged, 'mapping.yaml'), 'utf8')
        assert.match(mapping, /name: "\."/)
        assert.match(mapping, /C:\/save\.dat/)
        assert.ok(fs.existsSync(path.join(staged, 'drive-C', 'save.dat')))
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
      },
      { configDir, stagingRoot }
    )
    assert.equal(result.ok, true)
  } finally {
    setAchieveMeLudusaviConfigDir('')
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('restoreGame cloud-* fails when no drive-* files to restore', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-cloud-nomap-'))
  const configDir = path.join(base, 'cfg')
  const stagingRoot = path.join(base, 'staging')
  const gameDir = path.join(configDir, 'backup', 'Dota 2')
  const cloudId = 'cloud-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  fs.mkdirSync(path.join(gameDir, cloudId), { recursive: true })
  fs.writeFileSync(path.join(gameDir, cloudId, 'save.dat'), 'x')
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(configDir, 'backup').replace(/\\/g, '/')}\n`
  )
  const result = await restoreGame(
    'C:\\fake\\ludusavi.exe',
    'Dota 2',
    cloudId,
    async () => {
      throw new Error('should not run')
    },
    { configDir, stagingRoot }
  )
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /drive-\*|mapping|restorable/i)
  fs.rmSync(base, { recursive: true, force: true })
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

test('listGameBackups drops snapshots whose folders were deleted', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-list-'))
  const configDir = path.join(base, 'cfg')
  const gameDir = path.join(base, 'backups', 'Dota 2')
  fs.mkdirSync(configDir, { recursive: true })
  fs.mkdirSync(path.join(gameDir, 'b'), { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(base, 'backups').replace(/\\/g, '/')}\n`
  )
  setAchieveMeLudusaviConfigDir(configDir)
  try {
    const snaps = await listGameBackups('C:\\fake\\ludusavi.exe', 'Dota 2', async () => ({
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
    }))
    assert.deepEqual(
      snaps.map((s) => s.id),
      ['b']
    )
    assert.equal(snaps[0].source, 'local')
  } finally {
    setAchieveMeLudusaviConfigDir('')
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('listGameBackups keeps GUI snapshot when Ludusavi encoded a colon in the folder name', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-colon-list-'))
  const configDir = path.join(base, 'cfg')
  const gameDir = path.join(base, 'backups', 'Onimusha_ Way of the Sword')
  fs.mkdirSync(configDir, { recursive: true })
  fs.mkdirSync(gameDir, { recursive: true })
  fs.writeFileSync(
    path.join(gameDir, 'mapping.yaml'),
    'name: "Onimusha: Way of the Sword"\n'
  )
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(base, 'backups').replace(/\\/g, '/')}\n`
  )
  setAchieveMeLudusaviConfigDir(configDir)
  try {
    const snaps = await listGameBackups(
      'C:\\fake\\ludusavi.exe',
      'Onimusha: Way of the Sword',
      async () => ({
        code: 0,
        stdout: JSON.stringify({
          games: {
            'Onimusha: Way of the Sword': {
              backupPath: gameDir.replace(/\\/g, '/'),
              backups: [{ name: '.', when: '2026-09-10T15:50:02.643Z' }]
            }
          }
        }),
        stderr: ''
      })
    )
    assert.deepEqual(
      snaps.map((s) => s.id),
      ['.']
    )
    assert.equal(snaps[0].source, 'local')
  } finally {
    setAchieveMeLudusaviConfigDir('')
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('listGameBackups merges cloud download folders with source cloud', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-cloud-list-'))
  const configDir = path.join(base, 'cfg')
  const gameDir = path.join(base, 'backups', 'Dota 2')
  const artifactId = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  const cloudDir = path.join(gameDir, `cloud-${artifactId}`)
  fs.mkdirSync(configDir, { recursive: true })
  fs.mkdirSync(path.join(gameDir, 'local-a'), { recursive: true })
  fs.mkdirSync(cloudDir, { recursive: true })
  fs.writeFileSync(
    path.join(cloudDir, '.achieveme-cloud'),
    JSON.stringify({ artifactId, createdAt: '2026-09-10T18:00:00.000Z' })
  )
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${path.join(base, 'backups').replace(/\\/g, '/')}\n`
  )
  setAchieveMeLudusaviConfigDir(configDir)
  try {
    const snaps = await listGameBackups('C:\\fake\\ludusavi.exe', 'Dota 2', async () => ({
      code: 0,
      stdout: JSON.stringify({
        games: {
          'Dota 2': {
            backups: [{ name: 'local-a', when: '2024-01-01T00:00:00Z' }]
          }
        }
      }),
      stderr: ''
    }))
    assert.deepEqual(
      snaps.map((s) => ({ id: s.id, source: s.source })),
      [
        { id: `cloud-${artifactId}`, source: 'cloud' },
        { id: 'local-a', source: 'local' }
      ]
    )
  } finally {
    setAchieveMeLudusaviConfigDir('')
    fs.rmSync(base, { recursive: true, force: true })
  }
})
