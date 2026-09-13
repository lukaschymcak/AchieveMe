import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 5
const HERO_MISSING_MARKER = '.missing'
const COVER_FILENAME = 'cover.jpg'
const HERO_FILENAME = 'hero.jpg'
const SAFE_APPID_RE = /^\d+$/
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/

export type ImageDownloadResult =
  | { ok: true; body: Buffer; contentType?: string }
  | { ok: false; status: number }

export type ImageDownloader = (url: string) => Promise<ImageDownloadResult>

export type EnsureCachedResult =
  | { status: 'hit' | 'downloaded'; filePath: string }
  | { status: 'missing' | 'error' }

export interface ImageCacheDeps {
  /** Absolute path to `userData/images`. */
  cacheRoot: string
  download?: ImageDownloader
}

const inFlight = new Map<string, Promise<EnsureCachedResult>>()

/**
 * Default HTTPS downloader with redirect following and size cap.
 *
 * @param url - Absolute HTTPS URL.
 * @param redirectsLeft - Remaining redirect hops.
 * @returns Download result or failure with HTTP status.
 */
export function downloadHttpsImage(
  url: string,
  redirectsLeft = MAX_REDIRECTS
): Promise<ImageDownloadResult> {
  return new Promise((resolve) => {
    if (!url.startsWith('https://')) {
      resolve({ ok: false, status: 0 })
      return
    }

    https
      .get(url, (res) => {
        const status = res.statusCode ?? 0
        if (
          status >= 300 &&
          status < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume()
          const next = new URL(res.headers.location, url).href
          void downloadHttpsImage(next, redirectsLeft - 1).then(resolve)
          return
        }

        if (status !== 200) {
          res.resume()
          resolve({ ok: false, status })
          return
        }

        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > MAX_BYTES) {
            res.destroy()
            resolve({ ok: false, status: 413 })
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({
            ok: true,
            body: Buffer.concat(chunks),
            contentType: res.headers['content-type']
          })
        })
        res.on('error', () => resolve({ ok: false, status: 0 }))
      })
      .on('error', () => resolve({ ok: false, status: 0 }))
  })
}

function resolveDownloader(deps: ImageCacheDeps): ImageDownloader {
  return deps.download ?? downloadHttpsImage
}

/** Absolute path to `images/{appid}`. */
export function appImageDir(cacheRoot: string, appid: string): string {
  return path.join(cacheRoot, appid)
}

/** Absolute path to `images/{appid}/cover/cover.jpg`. */
export function coverFilePath(cacheRoot: string, appid: string): string {
  return path.join(cacheRoot, appid, 'cover', COVER_FILENAME)
}

/** Absolute path to `images/{appid}/hero/hero.jpg`. */
export function heroFilePath(cacheRoot: string, appid: string): string {
  return path.join(cacheRoot, appid, 'hero', HERO_FILENAME)
}

/** Absolute path to `images/{appid}/hero/.missing`. */
export function heroMissingPath(cacheRoot: string, appid: string): string {
  return path.join(cacheRoot, appid, 'hero', HERO_MISSING_MARKER)
}

/** Absolute path to `images/{appid}/icon/{filename}`. */
export function iconFilePath(cacheRoot: string, appid: string, filename: string): string {
  return path.join(cacheRoot, appid, 'icon', filename)
}

function atomicWriteFile(filePath: string, body: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, body)
  fs.renameSync(tmp, filePath)
}

function flightKey(kind: string, appid: string, filename = ''): string {
  return `${kind}:${appid}:${filename}`
}

async function withInFlight(
  key: string,
  work: () => Promise<EnsureCachedResult>
): Promise<EnsureCachedResult> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = work().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

function isSafeFilename(filename: string): boolean {
  return SAFE_FILENAME_RE.test(filename)
}

/**
 * Ensures a cover image is on disk; downloads from Steam when missing.
 *
 * @param deps - Cache root and optional downloader.
 * @param appid - Steam AppID.
 * @param remoteUrl - Steam Store `header_image` HTTPS URL.
 */
export async function ensureCoverCached(
  deps: ImageCacheDeps,
  appid: string,
  remoteUrl?: string
): Promise<EnsureCachedResult> {
  if (!SAFE_APPID_RE.test(appid)) return { status: 'error' }
  const dest = coverFilePath(deps.cacheRoot, appid)
  if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
  if (!remoteUrl) return { status: 'error' }

  return withInFlight(flightKey('cover', appid), async () => {
    if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
    if (!remoteUrl) return { status: 'error' }

    const result = await resolveDownloader(deps)(remoteUrl)
    if (!result.ok) return { status: result.status === 404 ? 'missing' : 'error' }

    try {
      atomicWriteFile(dest, result.body)
      return { status: 'downloaded', filePath: dest }
    } catch {
      return { status: 'error' }
    }
  })
}

/**
 * Ensures a library hero is on disk; writes `.missing` on 404.
 *
 * @param deps - Cache root and optional downloader.
 * @param appid - Steam AppID.
 * @param remoteUrl - Steam `library_hero.jpg` HTTPS URL.
 */
export async function ensureHeroCached(
  deps: ImageCacheDeps,
  appid: string,
  remoteUrl?: string
): Promise<EnsureCachedResult> {
  if (!SAFE_APPID_RE.test(appid)) return { status: 'error' }
  const dest = heroFilePath(deps.cacheRoot, appid)
  if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
  const missing = heroMissingPath(deps.cacheRoot, appid)
  if (fs.existsSync(missing)) return { status: 'missing' }
  if (!remoteUrl) return { status: 'error' }

  return withInFlight(flightKey('hero', appid), async () => {
    if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
    if (fs.existsSync(missing)) return { status: 'missing' }
    if (!remoteUrl) return { status: 'error' }

    const result = await resolveDownloader(deps)(remoteUrl)
    if (!result.ok) {
      if (result.status === 404) {
        try {
          fs.mkdirSync(path.dirname(missing), { recursive: true })
          fs.writeFileSync(missing, '')
        } catch {
          /* ignore marker write failures */
        }
        return { status: 'missing' }
      }
      return { status: 'error' }
    }

    try {
      atomicWriteFile(dest, result.body)
      return { status: 'downloaded', filePath: dest }
    } catch {
      return { status: 'error' }
    }
  })
}

/**
 * Ensures an achievement icon is on disk.
 *
 * @param deps - Cache root and optional downloader.
 * @param appid - Steam AppID.
 * @param filename - Safe icon filename (hash + extension).
 * @param remoteUrl - Absolute HTTPS CDN URL for the icon.
 */
export async function ensureIconCached(
  deps: ImageCacheDeps,
  appid: string,
  filename: string,
  remoteUrl?: string
): Promise<EnsureCachedResult> {
  if (!SAFE_APPID_RE.test(appid) || !isSafeFilename(filename)) {
    return { status: 'error' }
  }

  const dest = iconFilePath(deps.cacheRoot, appid, filename)
  if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
  if (!remoteUrl) return { status: 'error' }

  return withInFlight(flightKey('icon', appid, filename), async () => {
    if (fs.existsSync(dest)) return { status: 'hit', filePath: dest }
    if (!remoteUrl) return { status: 'error' }

    const result = await resolveDownloader(deps)(remoteUrl)
    if (!result.ok) return { status: result.status === 404 ? 'missing' : 'error' }

    try {
      atomicWriteFile(dest, result.body)
      return { status: 'downloaded', filePath: dest }
    } catch {
      return { status: 'error' }
    }
  })
}

/**
 * Clears the hero `.missing` marker so a force-refresh can retry the CDN.
 *
 * @param cacheRoot - Absolute path to `userData/images`.
 * @param appid - Steam AppID.
 */
export function clearHeroMissingMarker(cacheRoot: string, appid: string): void {
  if (!SAFE_APPID_RE.test(appid)) return
  const missing = heroMissingPath(cacheRoot, appid)
  try {
    if (fs.existsSync(missing)) fs.unlinkSync(missing)
  } catch {
    /* ignore */
  }
}

export interface PrefetchIconSpec {
  filename: string
  remoteUrl: string
}

export interface PrefetchGameImagesInput {
  coverRemoteUrl: string
  heroRemoteUrl: string
  icons: PrefetchIconSpec[]
  forceRefresh?: boolean
}

/**
 * Prefetches cover, hero, and achievement icons without blocking the caller.
 * Failures are swallowed; callers should fire-and-forget.
 *
 * @param deps - Cache root and optional downloader.
 * @param appid - Steam AppID.
 * @param input - Remote URLs and icon specs.
 */
export async function prefetchGameImages(
  deps: ImageCacheDeps,
  appid: string,
  input: PrefetchGameImagesInput
): Promise<void> {
  if (input.forceRefresh) {
    clearHeroMissingMarker(deps.cacheRoot, appid)
  }

  const tasks: Promise<unknown>[] = []
  if (input.coverRemoteUrl) {
    tasks.push(ensureCoverCached(deps, appid, input.coverRemoteUrl))
  }
  if (input.heroRemoteUrl) {
    tasks.push(ensureHeroCached(deps, appid, input.heroRemoteUrl))
  }

  const seen = new Set<string>()
  for (const icon of input.icons) {
    if (!icon.filename || seen.has(icon.filename)) continue
    seen.add(icon.filename)
    tasks.push(ensureIconCached(deps, appid, icon.filename, icon.remoteUrl))
  }

  await Promise.allSettled(tasks)
}

/**
 * Deletes `images/{appid}/` recursively.
 *
 * @param cacheRoot - Absolute path to `userData/images`.
 * @param appid - Steam AppID.
 */
export function pruneGameImages(cacheRoot: string, appid: string): void {
  if (!SAFE_APPID_RE.test(appid)) return
  const dir = appImageDir(cacheRoot, appid)
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

/** Clears in-flight map — for tests only. */
export function resetImageCacheInFlightForTests(): void {
  inFlight.clear()
}
