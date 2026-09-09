import React from 'react'
import type { GameHunterStats } from '../../../shared/types'
import {
  formatHunterReviewCount,
  formatHunterStatsLine,
  metacriticBand,
  shouldShowHunterStatsStrip,
  steamReviewTone
} from '../../../shared/hunterStatsUtils.ts'
import { getSteamStoreAppUrl } from '../../../shared/steamUrls.ts'

interface Props {
  appid: string
  stats: GameHunterStats
}

/**
 * Game Detail hunter strip: Metacritic, Steam review sentiment, Store link.
 */
export default function GameHunterStatsStrip({
  appid,
  stats
}: Props): React.ReactElement | null {
  const storeUrl = getSteamStoreAppUrl(appid)
  const showStats = shouldShowHunterStatsStrip(stats)
  if (!showStats && !storeUrl) return null

  const tone = steamReviewTone(stats.reviewSummary)
  const band =
    stats.metacritic !== null ? metacriticBand(stats.metacritic) : null
  const ariaLabel = showStats
    ? `${formatHunterStatsLine(stats) || 'Store ratings'}; Open on Steam`
    : 'Open on Steam'

  return (
    <div
      className="game-detail__hunter-stats"
      role="group"
      aria-label={ariaLabel}
    >
      {showStats && band !== null && stats.metacritic !== null && (
        <span
          className={`game-detail__metacritic game-detail__metacritic--${band}`}
          title="Metacritic"
        >
          {stats.metacritic}
        </span>
      )}

      {showStats && stats.reviewSummary && (
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

      {showStats && !stats.reviewSummary && stats.reviewCount !== null && (
        <span className="game-detail__hunter-reviews">
          <span className="game-detail__review-tone game-detail__review-tone--neutral">
            Reviews
          </span>
          <span className="game-detail__hunter-count">
            ({formatHunterReviewCount(stats.reviewCount)})
          </span>
        </span>
      )}

      {storeUrl ? (
        <a
          className="game-detail__steam-link"
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open game on Steam Store"
        >
          Steam
        </a>
      ) : null}
    </div>
  )
}
