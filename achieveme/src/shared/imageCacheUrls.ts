/** Custom Electron protocol for locally cached Steam images. */
export const IMAGE_CACHE_SCHEME = 'achieveme-img'

const SAFE_APPID_RE = /^\d+$/
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/

export type ImageCacheKind = 'cover' | 'hero' | 'icon'

export interface ParsedImageCacheUrl {
  kind: ImageCacheKind
  appid: string
  /** Present only for `icon` kind. */
  filename?: string
}

/**
 * Builds a display URL for a game's store cover image.
 *
 * @param appid - Steam AppID (digits only).
 * @returns Protocol URL, or empty string when `appid` is invalid.
 */
export function cacheCoverUrl(appid: string): string {
  if (!SAFE_APPID_RE.test(appid)) return ''
  return `${IMAGE_CACHE_SCHEME}://cover/${appid}`
}

/**
 * Builds a display URL for a game's library hero backdrop.
 *
 * @param appid - Steam AppID (digits only).
 * @returns Protocol URL, or empty string when `appid` is invalid.
 */
export function cacheHeroUrl(appid: string): string {
  if (!SAFE_APPID_RE.test(appid)) return ''
  return `${IMAGE_CACHE_SCHEME}://hero/${appid}`
}

/**
 * Builds a display URL for an achievement icon file.
 *
 * @param appid - Steam AppID (digits only).
 * @param filename - Safe icon filename (hash + extension).
 * @returns Protocol URL, or empty string when inputs are invalid.
 */
export function cacheIconUrl(appid: string, filename: string): string {
  if (!SAFE_APPID_RE.test(appid) || !SAFE_FILENAME_RE.test(filename)) return ''
  return `${IMAGE_CACHE_SCHEME}://icon/${appid}/${filename}`
}

/**
 * Extracts a safe disk filename from a Steam icon hash or CDN URL.
 * Does not import steamUrls so Node unit tests can load this module alone.
 *
 * @param value - Icon hash, protocol-relative URL, or absolute URL.
 * @returns Filename safe for disk, or empty string when none can be derived.
 */
export function iconFilenameFromSteamValue(value: string): string {
  if (!value) return ''
  if (value.includes('..')) return ''

  // Bare hash / filename from schema
  if (!value.includes('/') && !value.includes(':')) {
    return SAFE_FILENAME_RE.test(value) ? value : ''
  }

  let candidate = value
  if (value.startsWith('//')) candidate = `https:${value}`

  try {
    if (/^https?:\/\//i.test(candidate)) {
      const base = new URL(candidate).pathname.split('/').pop() ?? ''
      return SAFE_FILENAME_RE.test(base) ? base : ''
    }
  } catch {
    /* fall through */
  }

  const base = value.split('/').pop() ?? ''
  return SAFE_FILENAME_RE.test(base) ? base : ''
}

/**
 * Builds a cache icon URL from a Steam schema icon value (hash or HTTPS URL).
 *
 * @param appid - Steam AppID.
 * @param value - Icon hash or Steam CDN URL from SQLite / schema.
 * @returns Protocol URL, or empty string when the value cannot be mapped.
 */
export function cacheIconUrlFromSteamValue(appid: string, value: string): string {
  const filename = iconFilenameFromSteamValue(value)
  if (!filename) return ''
  return cacheIconUrl(appid, filename)
}

/**
 * Parses an `achieveme-img://` URL into kind / appid / optional filename.
 *
 * @param url - Full protocol URL (with or without trailing slash).
 * @returns Parsed parts, or null when the URL is malformed or unsafe.
 */
export function parseImageCacheUrl(url: string): ParsedImageCacheUrl | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== `${IMAGE_CACHE_SCHEME}:`) return null

  // standard schemes: host = kind, pathname = /{appid} or /{appid}/{filename}
  const kind = parsed.hostname as ImageCacheKind
  if (kind !== 'cover' && kind !== 'hero' && kind !== 'icon') return null

  const segments = parsed.pathname.replace(/^\/+/, '').split('/').filter(Boolean)
  if (segments.length === 0) return null

  const appid = segments[0]!
  if (!SAFE_APPID_RE.test(appid)) return null

  if (kind === 'cover' || kind === 'hero') {
    if (segments.length !== 1) return null
    return { kind, appid }
  }

  if (segments.length !== 2) return null
  const filename = segments[1]!
  if (!SAFE_FILENAME_RE.test(filename)) return null
  return { kind: 'icon', appid, filename }
}
