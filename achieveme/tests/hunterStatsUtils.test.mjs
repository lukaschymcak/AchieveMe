import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseSteamAppdetailsStats,
  formatHunterStatsLine,
  shouldShowHunterStatsStrip,
  isNumericSteamAppId,
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

test('formatHunterStatsLine omits missing pieces', () => {
  const line = formatHunterStatsLine({
    reviewPercent: 92,
    reviewCount: 40000,
    metacritic: 86,
    hasAny: true
  })
  assert.match(line, /Reviews/)
  assert.match(line, /92%/)
  assert.match(line, /Metacritic 86/)
  assert.doesNotMatch(line, /Main story|HLTB|HowLong/i)
})

test('formatHunterStatsLine with only count', () => {
  const line = formatHunterStatsLine({
    reviewPercent: null,
    reviewCount: 1234,
    metacritic: null,
    hasAny: true
  })
  assert.match(line, /1,?234|1234/)
  assert.doesNotMatch(line, /%/)
})
