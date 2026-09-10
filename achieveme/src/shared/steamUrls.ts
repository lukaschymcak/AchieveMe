/** Steam Community page for registering a Web API key. */
export const STEAM_WEB_API_KEY_URL = 'https://steamcommunity.com/dev/apikey'

/** Working Steam community assets CDN for achievement icons. */
const STEAM_ICON_CDN_PREFIX =
  'https://shared.akamai.steamstatic.com/community_assets/images/apps'

/**
 * Legacy schema URLs that 404 for newer apps; rewrite to the current CDN.
 * Example: steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/{appid}/{file}
 */
const LEGACY_ICON_CDN_RE =
  /^https?:\/\/steamcdn-a\.akamaihd\.net\/steamcommunity\/public\/images\/apps\/([^/]+)\/(.+)$/i

/**
 * Steam returns icon fields as hashes or full URLs; normalize to a working CDN URL.
 *
 * @param appid - Steam AppID (used when `value` is a bare hash/filename).
 * @param value - Icon hash, protocol-relative URL, or absolute URL from schema.
 * @returns Absolute HTTPS URL, or empty string when `value` is empty.
 */
export function normalizeSteamIconUrl(appid: string, value: string): string {
  if (!value) return ''

  const legacyMatch = value.match(LEGACY_ICON_CDN_RE)
  if (legacyMatch) {
    return `${STEAM_ICON_CDN_PREFIX}/${legacyMatch[1]}/${legacyMatch[2]}`
  }

  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return `${STEAM_ICON_CDN_PREFIX}/${appid}/${value}`
}

/** High-res library hero art (~3840×1240) used as a full-page backdrop. */
export function getSteamLibraryHeroUrl(appid: string): string {
  if (!appid) return ''
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`
}

/** Steam Store product page for a numeric AppID. */
export function getSteamStoreAppUrl(appid: string): string {
  const id = String(appid ?? '').trim()
  if (!/^\d+$/.test(id)) return ''
  return `https://store.steampowered.com/app/${encodeURIComponent(id)}`
}
