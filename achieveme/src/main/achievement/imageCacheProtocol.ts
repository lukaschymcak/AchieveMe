import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, protocol, net } from 'electron'
import { IMAGE_CACHE_SCHEME, parseImageCacheUrl } from '../../shared/imageCacheUrls'
import { getSteamLibraryHeroUrl, normalizeSteamIconUrl } from '../../shared/steamUrls'
import { getDb } from '../db/database'
import { getStoreCoverUrl } from './steamApiClient'
import {
  ensureCoverCached,
  ensureHeroCached,
  ensureIconCached,
  pruneGameImages,
  type ImageCacheDeps
} from './imageCacheService'

/**
 * Absolute path to `%APPDATA%/achieveme/images`.
 */
export function getImagesCacheRoot(): string {
  return path.join(app.getPath('userData'), 'images')
}

/** Deletes `images/{appid}/` under userData. */
export function pruneAppImages(appid: string): void {
  pruneGameImages(getImagesCacheRoot(), appid)
}

export function getDefaultImageCacheDeps(): ImageCacheDeps {
  return { cacheRoot: getImagesCacheRoot() }
}

/**
 * Must run before `app.whenReady()` so Chromium allows the custom scheme in `<img>` / CSS.
 */
export function registerImageCacheSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_CACHE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

function notFound(): Response {
  return new Response(null, { status: 404 })
}

/**
 * Registers `achieveme-img://` handler after `app.whenReady()`.
 * Downloads from Steam on cache miss, then serves the local file.
 */
export function registerImageCacheProtocol(): void {
  const deps = getDefaultImageCacheDeps()

  protocol.handle(IMAGE_CACHE_SCHEME, async (request) => {
    const parsed = parseImageCacheUrl(request.url)
    if (!parsed) return notFound()

    try {
      if (parsed.kind === 'cover') {
        const remoteUrl = await getStoreCoverUrl(getDb(), parsed.appid)
        if (!remoteUrl) return notFound()
        const result = await ensureCoverCached(deps, parsed.appid, remoteUrl)
        if (result.status !== 'hit' && result.status !== 'downloaded') return notFound()
        return net.fetch(pathToFileURL(result.filePath).href)
      }

      if (parsed.kind === 'hero') {
        const remoteUrl = getSteamLibraryHeroUrl(parsed.appid)
        if (!remoteUrl) return notFound()
        const result = await ensureHeroCached(deps, parsed.appid, remoteUrl)
        if (result.status !== 'hit' && result.status !== 'downloaded') return notFound()
        return net.fetch(pathToFileURL(result.filePath).href)
      }

      // icon
      const filename = parsed.filename
      if (!filename) return notFound()
      const remoteUrl = normalizeSteamIconUrl(parsed.appid, filename)
      if (!remoteUrl) return notFound()
      const result = await ensureIconCached(deps, parsed.appid, filename, remoteUrl)
      if (result.status !== 'hit' && result.status !== 'downloaded') return notFound()
      return net.fetch(pathToFileURL(result.filePath).href)
    } catch {
      return notFound()
    }
  })
}
