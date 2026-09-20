import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import zlib from 'node:zlib'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  assertSafeExtractRelativePath,
  createLudusaviBackupArchive,
  extractLudusaviBackupArchive,
  filterExistingLudusaviSnapshots,
  findMappingYamlInSnapshotDir,
  listGameRootMetadataToBundle,
  encodeLudusaviBackupFolderName,
  resolveLudusaviGameBackupDir,
  resolveLudusaviSnapshotDir,
  sanitizeLudusaviBackupTitle,
  trySplitUstarPath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
)

test('sanitizeLudusaviBackupTitle rejects empty and dot names', () => {
  assert.throws(() => sanitizeLudusaviBackupTitle(''))
  assert.throws(() => sanitizeLudusaviBackupTitle('.'))
  assert.throws(() => sanitizeLudusaviBackupTitle('..'))
  assert.equal(sanitizeLudusaviBackupTitle('Balatro'), 'Balatro')
})

test('encodeLudusaviBackupFolderName replaces Ludusavi invalid filename chars', () => {
  assert.equal(
    encodeLudusaviBackupFolderName('Onimusha: Way of the Sword'),
    'Onimusha_ Way of the Sword'
  )
  assert.equal(
    encodeLudusaviBackupFolderName('The Elder Scrolls V: Skyrim Special Edition'),
    'The Elder Scrolls V_ Skyrim Special Edition'
  )
  assert.equal(encodeLudusaviBackupFolderName('a/b'), 'a_b')
  assert.equal(encodeLudusaviBackupFolderName('foo*bar?'), 'foo_bar_')
})

test('resolveLudusaviGameBackupDir stays under backup/', () => {
  const configDir = path.join(os.tmpdir(), 'achieveme-archive-cfg')
  const resolved = resolveLudusaviGameBackupDir(configDir, 'Balatro')
  assert.ok(resolved.includes(`${path.sep}backup${path.sep}Balatro`))
})

test('readLudusaviBackupPathFromConfig uses backup.path from config.yaml', async () => {
  const { readLudusaviBackupPathFromConfig } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
  )
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-cfg-path-'))
  const configDir = path.join(base, 'ludusavi')
  await fs.promises.mkdir(configDir, { recursive: true })
  const customRoot = path.join(base, 'custom-backups')
  await fs.promises.writeFile(
    path.join(configDir, 'config.yaml'),
    `language: en-US\nbackup:\n  path: "${customRoot.replace(/\\/g, '/')}"\n  retention:\n    full: 5\nrestore:\n  path: "${customRoot.replace(/\\/g, '/')}"\n`
  )
  const resolved = readLudusaviBackupPathFromConfig(configDir)
  assert.equal(path.resolve(resolved), path.resolve(customRoot))
  assert.equal(
    resolveLudusaviGameBackupDir(configDir, 'Balatro'),
    path.resolve(customRoot, 'Balatro')
  )
})

test('readLudusaviBackupPathFromConfig expands ~ backup.path', async () => {
  const { readLudusaviBackupPathFromConfig } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
  )
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-tilde-path-'))
  const configDir = path.join(base, 'ludusavi')
  await fs.promises.mkdir(configDir, { recursive: true })
  await fs.promises.writeFile(
    path.join(configDir, 'config.yaml'),
    'backup:\n  path: ~/ludusavi-backup\n'
  )
  const resolved = readLudusaviBackupPathFromConfig(configDir)
  assert.equal(path.resolve(resolved), path.resolve(os.homedir(), 'ludusavi-backup'))
  fs.rmSync(base, { recursive: true, force: true })
})

test('resolveLudusaviGameBackupDir encodes colon titles like Ludusavi', () => {
  const configDir = path.join(os.tmpdir(), 'achieveme-colon-cfg')
  const resolved = resolveLudusaviGameBackupDir(configDir, 'Onimusha: Way of the Sword')
  assert.ok(resolved.endsWith(`${path.sep}Onimusha_ Way of the Sword`))
  assert.ok(!resolved.includes('Onimusha:'))
})

test('resolveLudusaviGameBackupDir finds folder via mapping.yaml name', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-map-dir-'))
  const configDir = path.join(base, 'cfg')
  const backupRoot = path.join(base, 'backups')
  const gameDir = path.join(backupRoot, 'renamed-onimusha')
  fs.mkdirSync(configDir, { recursive: true })
  fs.mkdirSync(gameDir, { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.yaml'),
    `backup:\n  path: ${backupRoot.replace(/\\/g, '/')}\n`
  )
  fs.writeFileSync(path.join(gameDir, 'mapping.yaml'), 'name: "Onimusha: Way of the Sword"\n')
  assert.equal(
    resolveLudusaviGameBackupDir(configDir, 'Onimusha: Way of the Sword'),
    path.resolve(gameDir)
  )
  fs.rmSync(base, { recursive: true, force: true })
})

test('filterExistingLudusaviSnapshots keeps GUI simple snapshot for encoded title dir', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-filter-colon-'))
  const gameDir = path.join(base, 'Onimusha_ Way of the Sword')
  fs.mkdirSync(gameDir, { recursive: true })
  const kept = filterExistingLudusaviSnapshots(gameDir, [{ id: '.' }, { id: 'gone' }])
  assert.deepEqual(
    kept.map((s) => s.id),
    ['.']
  )
  fs.rmSync(base, { recursive: true, force: true })
})

test('create and extract archive round-trip', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-archive-'))
  const configDir = path.join(base, 'ludusavi')
  const gameDir = path.join(configDir, 'backup', 'Balatro')
  await fs.promises.mkdir(gameDir, { recursive: true })
  await fs.promises.writeFile(path.join(gameDir, 'mapping.yaml'), 'ok: true\n')
  await fs.promises.mkdir(path.join(gameDir, 'nested'), { recursive: true })
  await fs.promises.writeFile(path.join(gameDir, 'nested', 'save.dat'), 'SAVE')

  const outDir = path.join(base, 'out')
  const archive = await createLudusaviBackupArchive({
    configDir,
    title: 'Balatro',
    appid: '2379780',
    outputDir: outDir,
    artifactId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  })
  assert.ok(fs.existsSync(archive.archivePath))
  assert.ok(archive.bytes > 0)
  assert.match(archive.sha256, /^[a-f0-9]{64}$/)

  const raw = zlib.gunzipSync(fs.readFileSync(archive.archivePath))
  assert.ok(raw.includes(Buffer.from('mapping.yaml')))
  assert.ok(raw.includes(Buffer.from('nested/save.dat')))

  const dest = path.join(base, 'extract')
  await extractLudusaviBackupArchive(archive.archivePath, dest)
  assert.equal(fs.readFileSync(path.join(dest, 'mapping.yaml'), 'utf8'), 'ok: true\n')
  assert.equal(fs.readFileSync(path.join(dest, 'nested', 'save.dat'), 'utf8'), 'SAVE')
})

test('assertSafeExtractRelativePath rejects .. entries', () => {
  const dest = path.join(os.tmpdir(), 'achieveme-extract-safe')
  assert.throws(() => assertSafeExtractRelativePath(dest, '../escape'))
  assert.throws(() => assertSafeExtractRelativePath(dest, 'a/../../escape'))
})

test('createLudusaviBackupArchive fails on empty dir', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-empty-'))
  const configDir = path.join(base, 'ludusavi')
  await fs.promises.mkdir(path.join(configDir, 'backup', 'Empty'), { recursive: true })
  await assert.rejects(() =>
    createLudusaviBackupArchive({
      configDir,
      title: 'Empty',
      appid: '1',
      outputDir: path.join(base, 'out'),
      artifactId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    })
  )
})

test('resolveLudusaviSnapshotDir rejects escapes', () => {
  const gameDir = path.join(os.tmpdir(), 'achieveme-snap-root')
  assert.throws(() => resolveLudusaviSnapshotDir(gameDir, '../evil'))
  assert.throws(() => resolveLudusaviSnapshotDir(gameDir, 'a/b'))
  assert.equal(resolveLudusaviSnapshotDir(gameDir, '.'), path.resolve(gameDir))
})

test('filterExistingLudusaviSnapshots drops missing dirs', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-filter-'))
  const gameDir = path.join(base, 'Game')
  fs.mkdirSync(path.join(gameDir, 'keep'), { recursive: true })
  const kept = filterExistingLudusaviSnapshots(gameDir, [
    { id: 'keep' },
    { id: 'gone' },
    { id: '.' }
  ])
  assert.deepEqual(
    kept.map((s) => s.id),
    ['keep', '.']
  )
  assert.deepEqual(filterExistingLudusaviSnapshots(path.join(base, 'missing'), [{ id: 'x' }]), [])
  fs.rmSync(base, { recursive: true, force: true })
})

test('cloud snapshot helpers write marker and list folders', async () => {
  const {
    cloudSnapshotBackupId,
    listCloudSnapshotFolders,
    prepareCloudSnapshotExtractDir,
    writeCloudSnapshotMarker,
    readCloudSnapshotMarker
  } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
  )
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-cloud-folder-'))
  const gameDir = path.join(base, 'Game')
  const localKeep = path.join(gameDir, 'local-snap')
  fs.mkdirSync(localKeep, { recursive: true })
  fs.writeFileSync(path.join(localKeep, 'save.dat'), 'local')
  const artifactId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const snapDir = await prepareCloudSnapshotExtractDir(gameDir, artifactId)
  fs.writeFileSync(path.join(snapDir, 'cloud.dat'), 'cloud')
  writeCloudSnapshotMarker(snapDir, {
    artifactId,
    createdAt: '2026-09-10T12:00:00.000Z'
  })
  assert.equal(cloudSnapshotBackupId(artifactId), `cloud-${artifactId}`)
  assert.equal(readCloudSnapshotMarker(snapDir)?.artifactId, artifactId)
  assert.ok(fs.existsSync(path.join(localKeep, 'save.dat')))
  const listed = listCloudSnapshotFolders(gameDir)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, `cloud-${artifactId}`)
  fs.rmSync(base, { recursive: true, force: true })
})

test('listGameRootMetadataToBundle pulls parent mapping.yaml', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-meta-'))
  const gameDir = path.join(base, 'Game')
  const snap = path.join(gameDir, '2024-01-02T00-00-00Z')
  fs.mkdirSync(snap, { recursive: true })
  fs.writeFileSync(path.join(gameDir, 'mapping.yaml'), 'name: Game\n')
  fs.writeFileSync(path.join(snap, 'save.dat'), 'x')
  const extras = listGameRootMetadataToBundle(gameDir, snap)
  assert.deepEqual(
    extras.map((e) => e.relativePath),
    ['mapping.yaml']
  )
  assert.equal(findMappingYamlInSnapshotDir(gameDir), path.join(gameDir, 'mapping.yaml'))
  fs.rmSync(base, { recursive: true, force: true })
})

test('createLudusaviBackupArchive includes parent mapping for named snapshot', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-map-pack-'))
  const configDir = path.join(base, 'ludusavi')
  const gameDir = path.join(configDir, 'backup', 'Balatro')
  const snap = path.join(gameDir, '2024-01-02T00-00-00Z')
  await fs.promises.mkdir(path.join(snap, 'drive-C'), { recursive: true })
  await fs.promises.writeFile(
    path.join(gameDir, 'mapping.yaml'),
    `---\nname: "Balatro"\ndrives:\n  drive-C: "C:"\nbackups:\n  - name: backup-old\n    files: {}\n`
  )
  await fs.promises.writeFile(path.join(snap, 'drive-C', 'save.dat'), 'SNAP')
  const archive = await createLudusaviBackupArchive({
    configDir,
    title: 'Balatro',
    appid: '2379780',
    outputDir: path.join(base, 'out'),
    artifactId: 'dddddddddddddddddddddddddddddddd',
    backupId: '2024-01-02T00-00-00Z'
  })
  const dest = path.join(base, 'extract')
  await extractLudusaviBackupArchive(archive.archivePath, dest)
  assert.equal(await fs.promises.readFile(path.join(dest, 'drive-C', 'save.dat'), 'utf8'), 'SNAP')
  const mapping = await fs.promises.readFile(path.join(dest, 'mapping.yaml'), 'utf8')
  assert.match(mapping, /name: "\."/)
  assert.match(mapping, /C:\/save\.dat/)
  assert.doesNotMatch(mapping, /backup-old/)
})

test('trySplitUstarPath handles short, prefixable, and overlong names', () => {
  assert.deepEqual(trySplitUstarPath('short.bin'), { name: 'short.bin', prefix: '' })
  const mid =
    'backup-20260910T135900Z/drive-C/Users/Public/Documents/Steam/RUNE/2054970/remote/win64_save/data00-1.bin'
  const split = trySplitUstarPath(mid)
  assert.ok(split)
  assert.ok(Buffer.from(split.name, 'utf8').length <= 100)
  assert.ok(Buffer.from(split.prefix, 'utf8').length <= 155)
  assert.equal(`${split.prefix}/${split.name}`, mid)
  const long = `${'a'.repeat(160)}/${'b'.repeat(120)}.bin`
  assert.equal(trySplitUstarPath(long), null)
})

test('create and extract archive round-trips paths longer than 100 bytes', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-longpath-'))
  const configDir = path.join(base, 'ludusavi')
  const gameDir = path.join(configDir, 'backup', 'Dragon')
  const deep = path.join(
    gameDir,
    'backup-20260910T135900Z',
    'drive-C',
    'Users',
    'Public',
    'Documents',
    'Steam',
    'RUNE',
    '2054970',
    'remote',
    'win64_save'
  )
  await fs.promises.mkdir(deep, { recursive: true })
  await fs.promises.writeFile(path.join(gameDir, 'mapping.yaml'), 'name: Dragon\n')
  await fs.promises.writeFile(path.join(deep, 'data00-1.bin'), 'LONGPATH')
  const archive = await createLudusaviBackupArchive({
    configDir,
    title: 'Dragon',
    appid: '2054970',
    outputDir: path.join(base, 'out'),
    artifactId: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  })
  const dest = path.join(base, 'extract')
  await extractLudusaviBackupArchive(archive.archivePath, dest)
  const restored = path.join(
    dest,
    'backup-20260910T135900Z',
    'drive-C',
    'Users',
    'Public',
    'Documents',
    'Steam',
    'RUNE',
    '2054970',
    'remote',
    'win64_save',
    'data00-1.bin'
  )
  assert.equal(await fs.promises.readFile(restored, 'utf8'), 'LONGPATH')
})

test('pruneOldLudusaviSnapshots rotates oldest snapshots, protects cloud-* and files', async () => {
  const { pruneOldLudusaviSnapshots } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
  )
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-prune-test-'))
  const gameDir = path.join(base, 'Game')
  await fs.promises.mkdir(gameDir, { recursive: true })

  // Create mapping.yaml file (must be preserved)
  await fs.promises.writeFile(path.join(gameDir, 'mapping.yaml'), 'name: Game\n')

  // Create 6 local snapshots (oldest to newest)
  const snaps = [
    '2024-01-01T10-00-00', // oldest
    '2024-01-02T10-00-00',
    '2024-01-03T10-00-00',
    '2024-01-04T10-00-00',
    '2024-01-05T10-00-00',
    '2024-01-06T10-00-00'  // newest
  ]
  for (const snap of snaps) {
    await fs.promises.mkdir(path.join(gameDir, snap), { recursive: true })
    await fs.promises.writeFile(path.join(gameDir, snap, 'data.bin'), snap)
  }

  // Create a cloud snapshot folder (MUST NOT be pruned)
  const cloudSnap = 'cloud-11112222333344445555666677778888'
  await fs.promises.mkdir(path.join(gameDir, cloudSnap), { recursive: true })
  await fs.promises.writeFile(path.join(gameDir, cloudSnap, 'cloud.bin'), 'cloud')

  try {
    // Non-existent folder returns pruned 0
    assert.deepEqual(await pruneOldLudusaviSnapshots(path.join(base, 'missing'), 5), { pruned: 0 })

    // When limit is 6, none pruned
    assert.deepEqual(await pruneOldLudusaviSnapshots(gameDir, 6), { pruned: 0 })

    // When limit is 5, 1 pruned (the oldest: 2024-01-01T10-00-00)
    const result = await pruneOldLudusaviSnapshots(gameDir, 5)
    assert.deepEqual(result, { pruned: 1 })

    // Check disk: oldest is deleted
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-01T10-00-00')), false)
    // The other 5 local snapshots remain
    for (let i = 1; i < snaps.length; i++) {
      assert.equal(fs.existsSync(path.join(gameDir, snaps[i])), true)
    }

    // Cloud snapshot is completely untouched
    assert.equal(fs.existsSync(path.join(gameDir, cloudSnap)), true)

    // mapping.yaml is completely untouched
    assert.equal(fs.existsSync(path.join(gameDir, 'mapping.yaml')), true)

    // Prune down to 3
    const pruneToThree = await pruneOldLudusaviSnapshots(gameDir, 3)
    assert.deepEqual(pruneToThree, { pruned: 2 })
    // Remaining snapshots should be the 3 newest: 2024-01-04, 2024-01-05, 2024-01-06
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-02T10-00-00')), false)
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-03T10-00-00')), false)
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-04T10-00-00')), true)
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-05T10-00-00')), true)
    assert.equal(fs.existsSync(path.join(gameDir, '2024-01-06T10-00-00')), true)
    assert.equal(fs.existsSync(path.join(gameDir, cloudSnap)), true)
  } finally {
    await fs.promises.rm(base, { recursive: true, force: true })
  }
})

test('pruneOldLudusaviSnapshots correctly parses and sorts Ludusavi backup-YYYYMMDDTHHMMSSZ naming', async () => {
  const { pruneOldLudusaviSnapshots } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
  )
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-compact-prune-'))
  const gameDir = path.join(base, 'Onimusha')
  await fs.promises.mkdir(gameDir, { recursive: true })

  const snaps = [
    'backup-20260911T100000Z', // oldest
    'backup-20260912T100000Z',
    'backup-20260913T100000Z',
    'backup-20260914T100000Z'  // newest
  ]
  for (const snap of snaps) {
    await fs.promises.mkdir(path.join(gameDir, snap))
  }

  try {
    const res = await pruneOldLudusaviSnapshots(gameDir, 2)
    assert.equal(res.pruned, 2)
    assert.equal(fs.existsSync(path.join(gameDir, 'backup-20260911T100000Z')), false)
    assert.equal(fs.existsSync(path.join(gameDir, 'backup-20260912T100000Z')), false)
    assert.equal(fs.existsSync(path.join(gameDir, 'backup-20260913T100000Z')), true)
    assert.equal(fs.existsSync(path.join(gameDir, 'backup-20260914T100000Z')), true)
  } finally {
    await fs.promises.rm(base, { recursive: true, force: true })
  }
})


