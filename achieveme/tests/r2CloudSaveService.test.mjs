import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { uploadGameCloudSave, downloadGameCloudSave } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/r2CloudSaveService.ts')).href
)
const { createLudusaviBackupArchive } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupArchive.ts')).href
)
const { R2_CLOUD_UPLOAD_FAILED_NOTE } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/r2CloudSaveUtils.ts')).href
)

async function makeBackupFixture() {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-r2-'))
  const configDir = path.join(base, 'ludusavi')
  const gameDir = path.join(configDir, 'backup', 'Balatro')
  await fs.promises.mkdir(path.join(gameDir, 'drive-C'), { recursive: true })
  await fs.promises.writeFile(
    path.join(gameDir, 'mapping.yaml'),
    `---\nname: "Balatro"\ndrives:\n  drive-C: "C:"\n`
  )
  await fs.promises.writeFile(path.join(gameDir, 'drive-C', 'save.dat'), 'SAVE')
  return { base, configDir, outputDir: path.join(base, 'out') }
}

test('uploadGameCloudSave skips when not configured', async () => {
  const { configDir, outputDir } = await makeBackupFixture()
  let calls = 0
  const result = await uploadGameCloudSave({
    settings: {
      cloudSavesApiUrl: '',
      cloudSavesApiToken: ''
    },
    appid: '2379780',
    title: 'Balatro',
    configDir,
    outputDir,
    fetchImpl: async () => {
      calls += 1
      return new Response('nope', { status: 500 })
    }
  })
  assert.equal(result.ok, false)
  assert.equal(calls, 0)
})

test('uploadGameCloudSave prepare → PUT → complete', async () => {
  const { configDir, outputDir } = await makeBackupFixture()
  const calls = []
  const result = await uploadGameCloudSave({
    settings: {
      cloudSavesApiUrl: 'https://saves.example.com',
      cloudSavesApiToken: 'secret-token'
    },
    appid: '2379780',
    title: 'Balatro',
    configDir,
    outputDir,
    fetchImpl: async (url, init) => {
      const href = String(url)
      calls.push({ href, method: init?.method, headers: init?.headers })
      if (href.endsWith('/v1/artifacts') && init?.method === 'POST') {
        const auth = new Headers(init.headers).get('Authorization')
        assert.equal(auth, 'Bearer secret-token')
        return Response.json({
          id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          uploadUrl: 'https://r2.example/put',
          requiredHeaders: {
            'Content-Type': 'application/gzip'
          }
        })
      }
      if (href === 'https://r2.example/put') {
        return new Response(null, { status: 200 })
      }
      if (href.includes('/complete')) {
        return Response.json({ ok: true, id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
      }
      return new Response('unexpected', { status: 500 })
    }
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.id, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  assert.equal(calls.length, 3)
})

test('uploadGameCloudSave maps 401 to soft note without throwing token', async () => {
  const { configDir, outputDir } = await makeBackupFixture()
  const result = await uploadGameCloudSave({
    settings: {
      cloudSavesApiUrl: 'https://saves.example.com',
      cloudSavesApiToken: 'secret-token'
    },
    appid: '2379780',
    title: 'Balatro',
    configDir,
    outputDir,
    fetchImpl: async () => new Response('no', { status: 401 })
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.softNote, R2_CLOUD_UPLOAD_FAILED_NOTE)
    assert.equal(result.softNote.includes('secret-token'), false)
  }
})

test('downloadGameCloudSave extracts into cloud folder without wiping siblings', async () => {
  const { base, configDir } = await makeBackupFixture()
  const gameDir = path.join(configDir, 'backup', 'Balatro')
  const localSnap = path.join(gameDir, '2024-01-01T00-00-00Z')
  await fs.promises.mkdir(localSnap, { recursive: true })
  await fs.promises.writeFile(path.join(localSnap, 'keep.dat'), 'LOCAL')

  const packDir = path.join(base, 'pack-src')
  await fs.promises.mkdir(packDir, { recursive: true })
  await fs.promises.writeFile(path.join(packDir, 'from-cloud.dat'), 'CLOUD')
  // Temporarily park pack under gameDir via a dedicated archive source fixture
  const packConfig = path.join(base, 'pack-cfg')
  const packGame = path.join(packConfig, 'backup', 'Balatro')
  await fs.promises.mkdir(packGame, { recursive: true })
  await fs.promises.writeFile(path.join(packGame, 'from-cloud.dat'), 'CLOUD')
  const archive = await createLudusaviBackupArchive({
    configDir: packConfig,
    title: 'Balatro',
    appid: '2379780',
    outputDir: path.join(base, 'archives'),
    artifactId: 'cccccccccccccccccccccccccccccccc'
  })
  const archiveBytes = await fs.promises.readFile(archive.archivePath)
  const artifactId = 'dddddddddddddddddddddddddddddddd'

  const result = await downloadGameCloudSave({
    settings: {
      cloudSavesApiUrl: 'https://saves.example.com',
      cloudSavesApiToken: 'secret-token'
    },
    appid: '2379780',
    title: 'Balatro',
    configDir,
    tempDir: path.join(base, 'tmp'),
    artifactId,
    fetchImpl: async (url, init) => {
      const href = String(url)
      if (href.includes('/v1/artifacts?') && (!init?.method || init.method === 'GET')) {
        return Response.json({
          artifacts: [
            {
              id: artifactId,
              appid: '2379780',
              bytes: archiveBytes.byteLength,
              sha256: 'ab',
              createdAt: '2026-09-10T15:00:00.000Z'
            }
          ]
        })
      }
      if (href.includes(`/v1/artifacts/${artifactId}/download`)) {
        return Response.json({ downloadUrl: 'https://r2.example/get' })
      }
      if (href === 'https://r2.example/get') {
        return new Response(archiveBytes, { status: 200 })
      }
      return new Response('unexpected', { status: 500 })
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.backupId, `cloud-${artifactId}`)
  assert.equal(
    await fs.promises.readFile(path.join(localSnap, 'keep.dat'), 'utf8'),
    'LOCAL'
  )
  assert.equal(
    await fs.promises.readFile(
      path.join(gameDir, `cloud-${artifactId}`, 'from-cloud.dat'),
      'utf8'
    ),
    'CLOUD'
  )
  assert.ok(
    fs.existsSync(path.join(gameDir, `cloud-${artifactId}`, '.achieveme-cloud'))
  )
})
