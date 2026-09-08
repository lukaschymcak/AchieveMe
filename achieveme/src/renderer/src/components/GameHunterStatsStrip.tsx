import React from 'react'
import type { GameHunterStats } from '../../../shared/types'
import {
  formatHunterReviewCount,
  formatHunterStatsLine,
  metacriticBand,
  shouldShowHunterStatsStrip,
  steamReviewTone
} from '../../../shared/hunterStatsUtils.ts'

interface Props {
  stats: GameHunterStats
}

/**
 * Game Detail hunter strip: Metacritic score box + Steam review sentiment.
 */
export default function GameHunterStatsStrip({ stats }: Props): React.ReactElement | null {
  if (!shouldShowHunterStatsStrip(stats)) return null

  const tone = steamReviewTone(stats.reviewSummary)
  const band =
    stats.metacritic !== null ? metacriticBand(stats.metacritic) : null

  return (
    <div
      className="game-detail__hunter-stats"
      role="group"
      aria-label={formatHunterStatsLine(stats) || 'Store ratings'}
    >
      {band !== null && stats.metacritic !== null && (
        <span
          className={`game-detail__metacritic game-detail__metacritic--${band}`}
          title="Metacritic"
        >
          {stats.metacritic}
        </span>
      )}

      {stats.reviewSummary && (
        <span className="game-detail__hunter-reviews">
          <span
            className={`game-detail__review-tone game-detail__review-tone--${tone}`}
          >
            {stats.reviewSummary}
          </span>
          {stats.reviewCount !== null && (
            <span className="game-detail__hunter-count">
              ({formatHunterReviewCount(stats.reviewCount)})
            </span>
          )}
        </span>
      )}

      {!stats.reviewSummary && stats.reviewCount !== null && (
        <span className="game-detail__hunter-reviews">
          <span className="game-detail__review-tone game-detail__review-tone--neutral">
            Reviews
          </span>
          <span className="game-detail__hunter-count">
            ({formatHunterReviewCount(stats.reviewCount)})
          </span>
        </span>
      )}
    </div>
  )
}
