import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  ensureCoverCached,
  ensureHeroCached,
  ensureIconCached,
  prefetchGameImages,
  pruneGameImages,
  coverFilePath,
  heroFilePath,
  heroMissingPath,
  iconFilePath,
  clearHeroMissingMarker,
  resetImageCacheInFlightForTests
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/imageCacheService.ts')).href
)

let cacheRoot = ''

beforeEach(() => {
  resetImageCacheInFlightForTests()
  cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-img-'))
})

afterEach(() => {
  resetImageCacheInFlightForTests()
  fs.rmSync(cacheRoot, { recursive: true, force: true })
})

test('ensureCoverCached downloads once then hits disk', async () => {
  let calls = 0
  const download = async () => {
    calls += 1
    return { ok: true, body: Buffer.from('cover-bytes') }
  }
  const deps = { cacheRoot, download }

  const first = await ensureCoverCached(deps, '570', 'https://example.com/cover.jpg')
  const second = await ensureCoverCached(deps, '570', 'https://example.com/cover.jpg')

  assert.equal(first.status, 'downloaded')
  assert.equal(second.status, 'hit')
  assert.equal(calls, 1)
  assert.equal(
    fs.readFileSync(coverFilePath(cacheRoot, '570'), 'utf8'),
    'cover-bytes'
  )
})

test('ensureCoverCached coalesces concurrent misses', async () => {
  let calls = 0
  const download = async () => {
    calls += 1
    await new Promise((r) => setTimeout(r, 30))
    return { ok: true, body: Buffer.from('cover') }
  }
  const deps = { cacheRoot, download }

  const [a, b] = await Promise.all([
    ensureCoverCached(deps, '570', 'https://example.com/cover.jpg'),
    ensureCoverCached(deps, '570', 'https://example.com/cover.jpg')
  ])

  assert.equal(calls, 1)
  assert.ok(a.status === 'downloaded' || a.status === 'hit')
  assert.ok(b.status === 'downloaded' || b.status === 'hit')
})

test('ensureHeroCached writes .missing on 404 and does not redownload', async () => {
  let calls = 0
  const download = async () => {
    calls += 1
    return { ok: false, status: 404 }
  }
  const deps = { cacheRoot, download }
  const heroUrl = 'https://cdn.example/library_hero.jpg'

  const first = await ensureHeroCached(deps, '570', heroUrl)
  const second = await ensureHeroCached(deps, '570', heroUrl)

  assert.equal(first.status, 'missing')
  assert.equal(second.status, 'missing')
  assert.equal(calls, 1)
  assert.ok(fs.existsSync(heroMissingPath(cacheRoot, '570')))
  assert.ok(!fs.existsSync(heroFilePath(cacheRoot, '570')))
})

test('clearHeroMissingMarker allows retry after force refresh', async () => {
  let calls = 0
  const download = async () => {
    calls += 1
    if (calls === 1) return { ok: false, status: 404 }
    return { ok: true, body: Buffer.from('hero') }
  }
  const deps = { cacheRoot, download }
  const heroUrl = 'https://cdn.example/library_hero.jpg'

  await ensureHeroCached(deps, '570', heroUrl)
  clearHeroMissingMarker(cacheRoot, '570')
  const second = await ensureHeroCached(deps, '570', heroUrl)

  assert.equal(second.status, 'downloaded')
  assert.equal(calls, 2)
  assert.equal(fs.readFileSync(heroFilePath(cacheRoot, '570'), 'utf8'), 'hero')
})

test('ensureIconCached stores under images/{appid}/icon/{filename}', async () => {
  const hash = '8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'
  let calls = 0
  const download = async () => {
    calls += 1
    return { ok: true, body: Buffer.from('icon') }
  }
  const deps = { cacheRoot, download }

  const result = await ensureIconCached(
    deps,
    '4570720',
    hash,
    `https://cdn.example/apps/4570720/${hash}`
  )
  assert.equal(result.status, 'downloaded')
  assert.equal(calls, 1)
  assert.ok(fs.existsSync(iconFilePath(cacheRoot, '4570720', hash)))
})

test('pruneGameImages deletes the whole appid tree', async () => {
  const download = async () => ({ ok: true, body: Buffer.from('x') })
  const deps = { cacheRoot, download }
  const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg'
  await ensureCoverCached(deps, '570', 'https://example.com/c.jpg')
  await ensureIconCached(deps, '570', hash, `https://cdn.example/${hash}`)

  pruneGameImages(cacheRoot, '570')

  assert.ok(!fs.existsSync(path.join(cacheRoot, '570')))
})

test('pruneGameImages rejects non-digit appids (path traversal)', () => {
  const evil = path.join(cacheRoot, '..', 'outside')
  fs.mkdirSync(evil, { recursive: true })
  pruneGameImages(cacheRoot, '../outside')
  assert.ok(fs.existsSync(evil))
})

test('prefetchGameImages downloads cover hero and icons', async () => {
  const urls = []
  const download = async (url) => {
    urls.push(url)
    return { ok: true, body: Buffer.from('blob') }
  }
  const deps = { cacheRoot, download }
  const hash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg'

  await prefetchGameImages(deps, '570', {
    coverRemoteUrl: 'https://example.com/header.jpg',
    heroRemoteUrl: 'https://cdn.example/library_hero.jpg',
    icons: [
      { filename: hash, remoteUrl: `https://cdn.example/${hash}` },
      { filename: hash, remoteUrl: `https://cdn.example/${hash}` }
    ]
  })

  assert.ok(fs.existsSync(coverFilePath(cacheRoot, '570')))
  assert.ok(fs.existsSync(heroFilePath(cacheRoot, '570')))
  assert.ok(fs.existsSync(iconFilePath(cacheRoot, '570', hash)))
  // cover + hero + one unique icon
  assert.equal(urls.length, 3)
})
