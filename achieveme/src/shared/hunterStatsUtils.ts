import type { GameHunterStats } from './types'

/** Empty hunter stats shape for parse failures and Store misses. */
export const EMPTY_HUNTER_STATS: GameHunterStats = {
  reviewPercent: null,
  reviewCount: null,
  metacritic: null,
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

const buildHunterStats = (
  reviewPercent: number | null,
  reviewCount: number | null,
  metacritic: number | null
): GameHunterStats => {
  const hasAny =
    reviewPercent !== null || reviewCount !== null || metacritic !== null
  return { reviewPercent, reviewCount, metacritic, hasAny }
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

  return buildHunterStats(reviewPercent, reviewCount, metacriticScore)
}

const formatCompactCount = (count: number): string => {
  if (count < 10000) {
    return String(count)
  }

  return `${Math.round(count / 1000)}k`
}

/**
 * Formats hunter stats as a single hunter strip line (HLTB deferred).
 */
export const formatHunterStatsLine = (stats: GameHunterStats): string => {
  const segments: string[] = []

  if (stats.reviewPercent !== null && stats.reviewCount !== null) {
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
 * Returns true when the hunter strip should render for the given stats.
 */
export const shouldShowHunterStatsStrip = (stats: GameHunterStats): boolean =>
  stats.hasAny
