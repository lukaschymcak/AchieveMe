import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  buildCloudSavesAuthorizationHeader,
  cloudSavesApiUrlHost,
  cloudSavesConfigured,
  isAllowedCloudSavesApiUrl,
  isCloudSaveAppid,
  isWithinCloudSaveArtifactCap,
  MAX_CLOUD_SAVE_ARTIFACT_BYTES,
  normalizeCloudSavesApiUrl
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/r2CloudSaveUtils.ts')).href)

test('isAllowedCloudSavesApiUrl allows https and local http', () => {
  assert.equal(isAllowedCloudSavesApiUrl('https://saves.example.com'), true)
  assert.equal(isAllowedCloudSavesApiUrl('http://127.0.0.1:8787'), true)
  assert.equal(isAllowedCloudSavesApiUrl('http://localhost:8787'), true)
  assert.equal(isAllowedCloudSavesApiUrl('http://evil.example'), false)
  assert.equal(isAllowedCloudSavesApiUrl(''), false)
})

test('cloudSavesConfigured requires url and token', () => {
  assert.equal(cloudSavesConfigured('https://saves.example.com', 'tok'), true)
  assert.equal(cloudSavesConfigured('https://saves.example.com', ''), false)
  assert.equal(cloudSavesConfigured('', 'tok'), false)
  assert.equal(cloudSavesConfigured('http://evil.example', 'tok'), false)
})

test('buildCloudSavesAuthorizationHeader builds Bearer header', () => {
  assert.equal(buildCloudSavesAuthorizationHeader('abc'), 'Bearer abc')
  assert.throws(() => buildCloudSavesAuthorizationHeader(''))
})

test('normalizeCloudSavesApiUrl strips trailing slash', () => {
  assert.equal(
    normalizeCloudSavesApiUrl('https://saves.example.com/'),
    'https://saves.example.com'
  )
})

test('cloudSavesApiUrlHost never includes credentials', () => {
  assert.equal(cloudSavesApiUrlHost('https://saves.example.com/v1'), 'saves.example.com')
  assert.equal(cloudSavesApiUrlHost(''), null)
})

test('isCloudSaveAppid and size cap', () => {
  assert.equal(isCloudSaveAppid('2379780'), true)
  assert.equal(isCloudSaveAppid('2379780/foo'), false)
  assert.equal(isWithinCloudSaveArtifactCap(1), true)
  assert.equal(isWithinCloudSaveArtifactCap(MAX_CLOUD_SAVE_ARTIFACT_BYTES + 1), false)
})
