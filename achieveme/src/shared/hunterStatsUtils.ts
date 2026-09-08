import type {
  GameHunterStats,
  MetacriticBand,
  SteamReviewTone
} from './types'

/** Empty hunter stats shape for parse failures and Store misses. */
export const EMPTY_HUNTER_STATS: GameHunterStats = {
  reviewPercent: null,
  reviewCount: null,
  metacritic: null,
  reviewSummary: null,
  hasAny: false
}

const NUMERIC_STEAM_APP_ID = /^\d+$/

/**
 * Returns true when `appid` is a non-empty digit-only Steam app id string.
 */
export const isNumericSteamAppId = (appid: string): boolean =>
  NUMERIC_STEAM_APP_ID.test(appid)

const finiteScore0to100 = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  if (value < 0 || value > 100) {
    return null
  }
  return value
}

const finiteCountNonNegative = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  if (value < 0) {
    return null
  }
  return value
}

/**
 * Builds a GameHunterStats object and sets hasAny from present fields.
 */
export const buildHunterStats = (
  reviewPercent: number | null,
  reviewCount: number | null,
  metacritic: number | null,
  reviewSummary: string | null = null
): GameHunterStats => {
  const summary =
    typeof reviewSummary === 'string' && reviewSummary.trim()
      ? reviewSummary.trim()
      : null
  const hasAny =
    reviewPercent !== null ||
    reviewCount !== null ||
    metacritic !== null ||
    summary !== null
  return {
    reviewPercent,
    reviewCount,
    metacritic,
    reviewSummary: summary,
    hasAny
  }
}

/**
 * Maps Steam review_score_desc to a UI tone class.
 */
export const steamReviewTone = (summary: string | null | undefined): SteamReviewTone => {
  if (!summary || !summary.trim()) return 'neutral'
  const s = summary.trim().toLowerCase()
  if (s === 'mixed') return 'mixed'
  if (s.includes('negative')) return 'negative'
  if (s.includes('positive')) return 'positive'
  return 'neutral'
}

/**
 * Metacritic color band: high ≥75, mid 50–74, low ≤49.
 */
export const metacriticBand = (score: number): MetacriticBand => {
  if (score >= 75) return 'high'
  if (score >= 50) return 'mid'
  return 'low'
}

/**
 * Parses Steam Store `appdetails` JSON for hunter stats fields.
 */
export const parseSteamAppdetailsStats = (
  body: string,
  appid: string
): GameHunterStats => {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return EMPTY_HUNTER_STATS
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return EMPTY_HUNTER_STATS
  }

  const entry = (parsed as Record<string, unknown>)[appid]
  if (typeof entry !== 'object' || entry === null) {
    return EMPTY_HUNTER_STATS
  }

  const record = entry as Record<string, unknown>
  if (record.success !== true) {
    return EMPTY_HUNTER_STATS
  }

  const data = record.data
  if (typeof data !== 'object' || data === null) {
    return EMPTY_HUNTER_STATS
  }

  const dataRecord = data as Record<string, unknown>

  const metacriticObj = dataRecord.metacritic
  const metacriticScore =
    typeof metacriticObj === 'object' &&
    metacriticObj !== null &&
    'score' in metacriticObj
      ? finiteScore0to100((metacriticObj as { score: unknown }).score)
      : null

  const recommendations = dataRecord.recommendations
  const reviewCount =
    typeof recommendations === 'object' &&
    recommendations !== null &&
    'total' in recommendations
      ? finiteCountNonNegative((recommendations as { total: unknown }).total)
      : null

  const reviews = dataRecord.reviews
  const reviewsPercent =
    typeof reviews === 'object' &&
    reviews !== null &&
    'percent' in reviews
      ? finiteScore0to100((reviews as { percent: unknown }).percent)
      : null

  const reviewScore = finiteScore0to100(dataRecord.review_score)
  const reviewPercent = reviewsPercent ?? reviewScore

  return buildHunterStats(reviewPercent, reviewCount, metacriticScore, null)
}

export type AppreviewsSummary = {
  reviewSummary: string | null
  reviewCount: number | null
  reviewPercent: number | null
}

/**
 * Parses Steam `appreviews` JSON `query_summary` for sentiment + counts.
 */
export const parseSteamAppreviewsSummary = (body: string): AppreviewsSummary => {
  const empty: AppreviewsSummary = {
    reviewSummary: null,
    reviewCount: null,
    reviewPercent: null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return empty
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return empty
  }

  const root = parsed as Record<string, unknown>
  const summary = root.query_summary
  if (typeof summary !== 'object' || summary === null) {
    return empty
  }

  const qs = summary as Record<string, unknown>
  const desc =
    typeof qs.review_score_desc === 'string' && qs.review_score_desc.trim()
      ? qs.review_score_desc.trim()
      : null

  const totalReviews = finiteCountNonNegative(qs.total_reviews)
  const totalPositive = finiteCountNonNegative(qs.total_positive)

  let reviewPercent: number | null = null
  if (
    totalReviews !== null &&
    totalReviews > 0 &&
    totalPositive !== null
  ) {
    reviewPercent = Math.round((totalPositive / totalReviews) * 100)
    if (reviewPercent < 0 || reviewPercent > 100) {
      reviewPercent = null
    }
  }

  return {
    reviewSummary: desc,
    reviewCount: totalReviews,
    reviewPercent
  }
}

/**
 * Merges Store appdetails stats with appreviews summary (reviews win when present).
 */
export const mergeHunterStats = (
  fromAppdetails: GameHunterStats,
  fromReviews: AppreviewsSummary
): GameHunterStats => {
  const reviewSummary = fromReviews.reviewSummary ?? fromAppdetails.reviewSummary
  const reviewCount = fromReviews.reviewCount ?? fromAppdetails.reviewCount
  const reviewPercent = fromReviews.reviewPercent ?? fromAppdetails.reviewPercent
  return buildHunterStats(
    reviewPercent,
    reviewCount,
    fromAppdetails.metacritic,
    reviewSummary
  )
}

const formatCompactCount = (count: number): string => {
  if (count < 10000) {
    return String(count)
  }

  return `${Math.round(count / 1000)}k`
}

/**
 * Formats hunter stats as a single hunter strip line (a11y / fallback).
 */
export const formatHunterStatsLine = (stats: GameHunterStats): string => {
  const segments: string[] = []

  if (stats.reviewSummary) {
    if (stats.reviewCount !== null) {
      segments.push(
        `${stats.reviewSummary} (${formatCompactCount(stats.reviewCount)})`
      )
    } else {
      segments.push(stats.reviewSummary)
    }
  } else if (stats.reviewPercent !== null && stats.reviewCount !== null) {
    segments.push(
      `Reviews ${stats.reviewPercent}% (${formatCompactCount(stats.reviewCount)})`
    )
  } else if (stats.reviewPercent !== null) {
    segments.push(`Reviews ${stats.reviewPercent}%`)
  } else if (stats.reviewCount !== null) {
    segments.push(`Reviews (${formatCompactCount(stats.reviewCount)})`)
  }

  if (stats.metacritic !== null) {
    segments.push(`Metacritic ${stats.metacritic}`)
  }

  return segments.join(' · ')
}

/**
 * Compact review count for UI chips.
 */
export const formatHunterReviewCount = (count: number): string =>
  formatCompactCount(count)

/**
 * Returns true when the hunter strip should render for the given stats.
 */
export const shouldShowHunterStatsStrip = (stats: GameHunterStats): boolean =>
  stats.hasAny
