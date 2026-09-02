import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  IMAGE_CACHE_SCHEME,
  cacheCoverUrl,
  cacheHeroUrl,
  cacheIconUrl,
  cacheIconUrlFromSteamValue,
  iconFilenameFromSteamValue,
  parseImageCacheUrl
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/imageCacheUrls.ts')).href)

test('cacheCoverUrl / cacheHeroUrl build protocol URLs', () => {
  assert.equal(cacheCoverUrl('570'), `${IMAGE_CACHE_SCHEME}://cover/570`)
  assert.equal(cacheHeroUrl('570'), `${IMAGE_CACHE_SCHEME}://hero/570`)
})

test('cacheCoverUrl rejects non-digit appids', () => {
  assert.equal(cacheCoverUrl(''), '')
  assert.equal(cacheCoverUrl('../x'), '')
  assert.equal(cacheCoverUrl('abc'), '')
})

test('cacheIconUrl builds and rejects unsafe filenames', () => {
  assert.equal(
    cacheIconUrl('570', 'abc123.jpg'),
    `${IMAGE_CACHE_SCHEME}://icon/570/abc123.jpg`
  )
  assert.equal(cacheIconUrl('570', '../evil.jpg'), '')
  assert.equal(cacheIconUrl('570', ''), '')
})

test('iconFilenameFromSteamValue extracts basename from hash and URL', () => {
  assert.equal(
    iconFilenameFromSteamValue('8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'),
    '8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'
  )
  assert.equal(
    iconFilenameFromSteamValue(
      'https://shared.akamai.steamstatic.com/community_assets/images/apps/4570720/927877c8802547b3cf0b5c720433e78ee1a78338.jpg'
    ),
    '927877c8802547b3cf0b5c720433e78ee1a78338.jpg'
  )
  assert.equal(iconFilenameFromSteamValue(''), '')
  assert.equal(iconFilenameFromSteamValue('../evil.jpg'), '')
})

test('cacheIconUrlFromSteamValue maps Steam values to protocol URLs', () => {
  assert.equal(
    cacheIconUrlFromSteamValue('4570720', '8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'),
    `${IMAGE_CACHE_SCHEME}://icon/4570720/8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg`
  )
  assert.equal(cacheIconUrlFromSteamValue('570', ''), '')
})

test('parseImageCacheUrl parses cover hero and icon', () => {
  assert.deepEqual(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://cover/570`), {
    kind: 'cover',
    appid: '570'
  })
  assert.deepEqual(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://hero/570`), {
    kind: 'hero',
    appid: '570'
  })
  assert.deepEqual(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://icon/570/abc.jpg`), {
    kind: 'icon',
    appid: '570',
    filename: 'abc.jpg'
  })
})

test('parseImageCacheUrl rejects traversal and bad kinds', () => {
  assert.equal(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://icon/570/../x.jpg`), null)
  assert.equal(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://icon/570`), null)
  assert.equal(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://cover/570/extra`), null)
  assert.equal(parseImageCacheUrl(`${IMAGE_CACHE_SCHEME}://cover/not-digits`), null)
  assert.equal(parseImageCacheUrl('https://cdn.example/cover/570'), null)
  assert.equal(parseImageCacheUrl(''), null)
})
