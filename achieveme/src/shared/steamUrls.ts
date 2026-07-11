/** Steam returns icon fields as hashes; build a full CDN URL. */
export function normalizeSteamIconUrl(appid: string, value: string): string {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${value}`
}