import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseSteamAppdetailsStats,
  parseSteamAppreviewsSummary,
  mergeHunterStats,
  formatHunterStatsLine,
  shouldShowHunterStatsStrip,
  isNumericSteamAppId,
  steamReviewTone,
  metacriticBand,
  EMPTY_HUNTER_STATS
} from '../src/shared/hunterStatsUtils.ts'

test('isNumericSteamAppId accepts digits only', () => {
  assert.equal(isNumericSteamAppId('570'), true)
  assert.equal(isNumericSteamAppId('Game'), false)
})

test('parseSteamAppdetailsStats maps metacritic and recommendations.total', () => {
  const body = JSON.stringify({
    '570': {
      success: true,
      data: {
        name: 'Dota 2',
        metacritic: { score: 90 },
        recommendations: { total: 40123 }
      }
    }
  })
  const stats = parseSteamAppdetailsStats(body, '570')
  assert.equal(stats.metacritic, 90)
  assert.equal(stats.reviewCount, 40123)
  assert.equal(stats.reviewPercent, null)
  assert.equal(stats.reviewSummary, null)
  assert.equal(stats.hasAny, true)
})

test('parseSteamAppdetailsStats keeps reviewPercent only when present', () => {
  const body = JSON.stringify({
    '570': {
      success: true,
      data: {
        recommendations: { total: 10 }
      }
    }
  })
  const stats = parseSteamAppdetailsStats(body, '570')
  assert.equal(stats.reviewPercent, null)
  assert.equal(stats.reviewCount, 10)
})

test('parseSteamAppdetailsStats maps reviews.percent to reviewPercent', () => {
  const body = JSON.stringify({
    '570': {
      success: true,
      data: {
        reviews: { percent: 92 }
      }
    }
  })
  const stats = parseSteamAppdetailsStats(body, '570')
  assert.equal(stats.reviewPercent, 92)
})

test('parseSteamAppdetailsStats maps review_score to reviewPercent', () => {
  const body = JSON.stringify({
    '570': {
      success: true,
      data: {
        review_score: 88
      }
    }
  })
  const stats = parseSteamAppdetailsStats(body, '570')
  assert.equal(stats.reviewPercent, 88)
})

test('parseSteamAppdetailsStats prefers reviews.percent over review_score', () => {
  const body = JSON.stringify({
    '570': {
      success: true,
      data: {
        reviews: { percent: 92 },
        review_score: 88
      }
    }
  })
  const stats = parseSteamAppdetailsStats(body, '570')
  assert.equal(stats.reviewPercent, 92)
})

test('parseSteamAppdetailsStats returns empty on success false', () => {
  const body = JSON.stringify({ '999': { success: false } })
  const stats = parseSteamAppdetailsStats(body, '999')
  assert.deepEqual(stats, EMPTY_HUNTER_STATS)
  assert.equal(shouldShowHunterStatsStrip(stats), false)
})

test('parseSteamAppreviewsSummary maps query_summary', () => {
  const body = JSON.stringify({
    success: 1,
    query_summary: {
      review_score_desc: 'Very Positive',
      total_positive: 9200,
      total_negative: 800,
      total_reviews: 10000
    }
  })
  const summary = parseSteamAppreviewsSummary(body)
  assert.equal(summary.reviewSummary, 'Very Positive')
  assert.equal(summary.reviewCount, 10000)
  assert.equal(summary.reviewPercent, 92)
})

test('parseSteamAppreviewsSummary returns empty on malformed', () => {
  assert.deepEqual(parseSteamAppreviewsSummary('not-json'), {
    reviewSummary: null,
    reviewCount: null,
    reviewPercent: null
  })
})

test('steamReviewTone maps Steam labels', () => {
  assert.equal(steamReviewTone('Overwhelmingly Positive'), 'positive')
  assert.equal(steamReviewTone('Very Positive'), 'positive')
  assert.equal(steamReviewTone('Mostly Positive'), 'positive')
  assert.equal(steamReviewTone('Mixed'), 'mixed')
  assert.equal(steamReviewTone('Mostly Negative'), 'negative')
  assert.equal(steamReviewTone('Very Negative'), 'negative')
  assert.equal(steamReviewTone('Overwhelmingly Negative'), 'negative')
  assert.equal(steamReviewTone('No user reviews'), 'neutral')
  assert.equal(steamReviewTone(null), 'neutral')
})

test('metacriticBand maps score ranges', () => {
  assert.equal(metacriticBand(75), 'high')
  assert.equal(metacriticBand(100), 'high')
  assert.equal(metacriticBand(50), 'mid')
  assert.equal(metacriticBand(74), 'mid')
  assert.equal(metacriticBand(49), 'low')
  assert.equal(metacriticBand(0), 'low')
})

test('mergeHunterStats prefers appreviews summary and count', () => {
  const fromDetails = parseSteamAppdetailsStats(
    JSON.stringify({
      '570': {
        success: true,
        data: {
          metacritic: { score: 84 },
          recommendations: { total: 100 }
        }
      }
    }),
    '570'
  )
  const merged = mergeHunterStats(fromDetails, {
    reviewSummary: 'Overwhelmingly Positive',
    reviewCount: 32000,
    reviewPercent: 96
  })
  assert.equal(merged.metacritic, 84)
  assert.equal(merged.reviewSummary, 'Overwhelmingly Positive')
  assert.equal(merged.reviewCount, 32000)
  assert.equal(merged.reviewPercent, 96)
  assert.equal(merged.hasAny, true)
})

test('formatHunterStatsLine includes summary when present', () => {
  const line = formatHunterStatsLine({
    reviewPercent: 92,
    reviewCount: 40000,
    metacritic: 86,
    reviewSummary: 'Very Positive',
    hasAny: true
  })
  assert.match(line, /Very Positive/)
  assert.match(line, /40k/)
  assert.match(line, /Metacritic 86/)
  assert.doesNotMatch(line, /Main story|HLTB|HowLong/i)
})

test('formatHunterStatsLine omits missing pieces', () => {
  const line = formatHunterStatsLine({
    reviewPercent: 92,
    reviewCount: 40000,
    metacritic: 86,
    reviewSummary: null,
    hasAny: true
  })
  assert.match(line, /Reviews/)
  assert.match(line, /92%/)
  assert.match(line, /Metacritic 86/)
})

test('formatHunterStatsLine with only count', () => {
  const line = formatHunterStatsLine({
    reviewPercent: null,
    reviewCount: 1234,
    metacritic: null,
    reviewSummary: null,
    hasAny: true
  })
  assert.match(line, /1,?234|1234/)
  assert.doesNotMatch(line, /%/)
})
