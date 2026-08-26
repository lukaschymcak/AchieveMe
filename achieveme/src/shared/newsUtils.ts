/**
 * Steam release-date bucketing for the News page calendar.
 */

export type ReleaseBucket = 'thisWeek' | 'thisMonth' | 'later' | 'tba' | 'releasedThisWeek'

const DAY_SECONDS = 86400
const WEEK_SECONDS = 7 * DAY_SECONDS
const MONTH_SECONDS = 31 * DAY_SECONDS

const TBA_LABELS = /^(coming soon|to be announced|tba|soon)$/i

/**
 * Parses a Steam store search release label into unix seconds, or null for TBA/unknown.
 *
 * @param label - Raw label from `.search_released` (e.g. "24 Mar, 2026").
 * @param now - Reference Date (defaults to current time; used for year inference).
 */
export function parseSteamReleaseLabel(
  label: string,
  now: Date = new Date()
): number | null {
  const trimmed = String(label || '')
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!trimmed || TBA_LABELS.test(trimmed)) return null

  // "24 Mar, 2026" / "Mar 24, 2026" / "24 Mar 2026"
  const withYear =
    trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/) ||
    trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/)

  if (withYear) {
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000)
    }
  }

  // "24 Mar" / "Mar 24" — assume current year, or next year if date already passed
  const noYear =
    trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})$/) ||
    trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/)

  if (noYear) {
    const year = now.getFullYear()
    const candidate = Date.parse(`${trimmed}, ${year}`)
    if (Number.isNaN(candidate)) return null
    let unix = Math.floor(candidate / 1000)
    const nowUnix = Math.floor(now.getTime() / 1000)
    // If the date is more than ~1 day in the past and has no year, treat as next year
    if (unix < nowUnix - DAY_SECONDS) {
      const next = Date.parse(`${trimmed}, ${year + 1}`)
      if (!Number.isNaN(next)) {
        unix = Math.floor(next / 1000)
      }
    }
    return unix
  }

  // Year-only labels like "2026" / "2027" — treat as TBA for week/month bucketing
  if (/^(19|20)\d{2}$/.test(trimmed)) return null

  const fallback = Date.parse(trimmed)
  if (Number.isNaN(fallback)) return null
  return Math.floor(fallback / 1000)
}

/**
 * Buckets a release unix timestamp relative to `now`.
 *
 * - Future 0–7d → thisWeek
 * - Future 8–31d → thisMonth
 * - Future >31d → later
 * - Past 0–7d → releasedThisWeek
 * - null → tba; far past → later
 *
 * @param unixSeconds - Release time, or null for TBA.
 * @param now - Reference Date.
 */
export function bucketRelease(
  unixSeconds: number | null,
  now: Date = new Date()
): ReleaseBucket {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return 'tba'

  const nowUnix = Math.floor(now.getTime() / 1000)
  const delta = unixSeconds - nowUnix

  if (delta >= 0) {
    if (delta <= WEEK_SECONDS) return 'thisWeek'
    if (delta <= MONTH_SECONDS) return 'thisMonth'
    return 'later'
  }

  const past = -delta
  if (past <= WEEK_SECONDS) return 'releasedThisWeek'
  return 'later'
}

/**
 * Formats calendar days from today to a release date (e.g. "in 3 days", "today", "2 days ago").
 *
 * @param unixSeconds - Release time, or null for TBA.
 * @param now - Reference Date.
 * @returns Relative label, or null when the release date is unknown.
 */
export function formatReleaseDaysFromToday(
  unixSeconds: number | null,
  now: Date = new Date()
): string | null {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return null

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const release = new Date(unixSeconds * 1000)
  const startOfRelease = new Date(release.getFullYear(), release.getMonth(), release.getDate())
  const days = Math.round(
    (startOfRelease.getTime() - startOfToday.getTime()) / (DAY_SECONDS * 1000)
  )

  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  if (days > 1) return `in ${days} days`
  if (days === -1) return '1 day ago'
  return `${Math.abs(days)} days ago`
}

/**
 * Deduplicates releases by appid, keeping the first occurrence.
 *
 * @param items - Release rows.
 */
export function dedupeReleasesByAppid<T extends { appid: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const id = String(item.appid || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(item)
  }
  return out
}

/**
 * Picks up to `limit` library appids, preferring most recently unlocked.
 *
 * @param games - Library games with last_unlocked_at.
 * @param limit - Max count (default 20).
 */
export function pickLibraryNewsAppids(
  games: Array<{ appid: string; last_unlocked_at: number }>,
  limit = 20
): string[] {
  const sorted = [...games].sort((a, b) => {
    const byUnlock = (b.last_unlocked_at || 0) - (a.last_unlocked_at || 0)
    if (byUnlock !== 0) return byUnlock
    return String(a.appid).localeCompare(String(b.appid))
  })
  return sorted.slice(0, limit).map((g) => String(g.appid).trim()).filter(Boolean)
}
