import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { normalizeSteamIconUrl, getSteamLibraryHeroUrl } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/steamUrls.ts')).href
)

test('normalizeSteamIconUrl returns empty for empty input', () => {
  assert.equal(normalizeSteamIconUrl('4570720', ''), '')
})

test('normalizeSteamIconUrl builds hash on community_assets CDN', () => {
  assert.equal(
    normalizeSteamIconUrl('4570720', '8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'),
    'https://shared.akamai.steamstatic.com/community_assets/images/apps/4570720/8ca5ef07bad2e1d9a46cec2bf6dd02fce360f77e.jpg'
  )
})

test('normalizeSteamIconUrl rewrites legacy steamcdn-a full URLs', () => {
  const legacy =
    'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/4570720/927877c8802547b3cf0b5c720433e78ee1a78338.jpg'
  assert.equal(
    normalizeSteamIconUrl('4570720', legacy),
    'https://shared.akamai.steamstatic.com/community_assets/images/apps/4570720/927877c8802547b3cf0b5c720433e78ee1a78338.jpg'
  )
})

test('normalizeSteamIconUrl passes through already-new CDN URLs', () => {
  const current =
    'https://shared.akamai.steamstatic.com/community_assets/images/apps/4570720/927877c8802547b3cf0b5c720433e78ee1a78338.jpg'
  assert.equal(normalizeSteamIconUrl('4570720', current), current)
})

test('normalizeSteamIconUrl upgrades protocol-relative URLs', () => {
  assert.equal(
    normalizeSteamIconUrl('480', '//example.com/icon.jpg'),
    'https://example.com/icon.jpg'
  )
})

test('getSteamLibraryHeroUrl builds cloudflare steamstatic path', () => {
  assert.equal(
    getSteamLibraryHeroUrl('4570720'),
    'https://cdn.cloudflare.steamstatic.com/steam/apps/4570720/library_hero.jpg'
  )
})
