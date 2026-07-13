/** Steam returns icon fields as hashes; build a full CDN URL. */
export function normalizeSteamIconUrl(appid: string, value: string): string {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${value}`
}

/** High-res library hero art (~3840×1240) used as a full-page backdrop. */
export function getSteamLibraryHeroUrl(appid: string): string {
  if (!appid) return ''
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`
}