/**
 * Pure helpers for the Wanted collection (unowned Steam titles in the Library rail).
 */

export type WantedAddRejection = 'invalid-appid' | 'in-library'

/**
 * Digits-only Steam AppID, or null when invalid.
 *
 * @param appid - Raw AppID string.
 */
export function normalizeWantedAppid(appid: string): string | null {
  const clean = String(appid || '').trim()
  if (!/^\d+$/.test(clean)) return null
  return clean
}

/**
 * Why an add/pin should be rejected, or null when the AppID may be wanted.
 *
 * @param input - Candidate AppID and current library AppID set.
 */
export function wantedAddRejection(input: {
  appid: string
  libraryAppids: ReadonlySet<string>
}): WantedAddRejection | null {
  const appid = normalizeWantedAppid(input.appid)
  if (!appid) return 'invalid-appid'
  if (input.libraryAppids.has(appid)) return 'in-library'
  return null
}

/**
 * Newest-first by `addedAt` (descending). Stable for equal timestamps.
 *
 * @param games - Wanted rows.
 */
export function sortWantedNewestFirst<T extends { addedAt: number; appid: string }>(
  games: readonly T[]
): T[] {
  return [...games].sort((a, b) => {
    if (b.addedAt !== a.addedAt) return b.addedAt - a.addedAt
    return a.appid.localeCompare(b.appid)
  })
}

/**
 * Steam store URL for a Wanted card click.
 *
 * @param appid - Digits-only Steam AppID.
 */
export function wantedStoreUrl(appid: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(appid)}`
}
