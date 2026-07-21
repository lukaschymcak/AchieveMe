import React, { useCallback, useEffect, useState } from 'react'
import type { ProfileStats } from '../../../shared/types'
import { AppChrome, AppNav, AppShell, Chip } from '../components/app'
import HelpTip from '../components/HelpTip'
import type { AppPage } from '../lib/appNavigation'
import { TOOLTIPS, EMPTY_STATES } from '../lib/helpContent'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
  onSelectGame?: (appid: string) => void
}

type LoadState = 'loading' | 'ready' | 'error'
type StatTier = 'platinum' | 'gold' | 'silver' | 'bronze'

const LOAD_ERROR =
  'Could not load profile stats. Check that your library data is available and try again.'

const XP_PER_LEVEL = 1000

const TIER_SHELF: Array<{
  key: keyof Pick<ProfileStats, 'platinum' | 'gold' | 'silver' | 'bronze'>
  label: string
  tip: string
  tier: StatTier
}> = [
  { key: 'platinum', label: 'Platinum', tip: TOOLTIPS.platinumStat, tier: 'platinum' },
  { key: 'gold', label: 'Gold', tip: TOOLTIPS.goldStat, tier: 'gold' },
  { key: 'silver', label: 'Silver', tip: TOOLTIPS.silverStat, tier: 'silver' },
  { key: 'bronze', label: 'Bronze', tip: TOOLTIPS.bronzeStat, tier: 'bronze' }
]

function computeLevelProgress(xp: number): {
  level: number
  xpInLevel: number
  xpToNext: number
  levelPct: number
} {
  const level = Math.floor(xp / XP_PER_LEVEL)
  const xpInLevel = xp % XP_PER_LEVEL
  const xpToNext = XP_PER_LEVEL - xpInLevel
  const levelPct =
    xpInLevel === 0 && xp > 0 ? 100 : Math.round((xpInLevel / XP_PER_LEVEL) * 100)

  return { level, xpInLevel, xpToNext, levelPct }
}

function formatActivityMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split('-')
  const parsedYear = Number(year)
  const parsedMonth = Number(month)
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
    return isoMonth
  }

  return new Date(parsedYear, parsedMonth - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric'
  })
}

function formatUnlockDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}

function unlockCountLabel(count: number): string {
  return `${count} unlock${count === 1 ? '' : 's'}`
}

function unlocksPerGame(totalUnlocked: number, totalGames: number): string {
  if (totalGames === 0) {
    return '—'
  }

  const average = totalUnlocked / totalGames
  return average >= 10 ? average.toFixed(0) : average.toFixed(1)
}

function formatTotalPlaytime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function DashboardPage({
  page,
  onNavigate,
  onSelectGame
}: Props): React.ReactElement {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchStats = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false

    if (!silent) {
      setLoadState('loading')
      setErrorMessage(null)
    }

    return window.api
      .getProfileStats()
      .then((data) => {
        setStats(data)
        setErrorMessage(null)
        setLoadState('ready')
      })
      .catch(() => {
        if (!silent) {
          setLoadState('error')
          setErrorMessage(LOAD_ERROR)
          return
        }

        setStats((current) => {
          if (current === null) {
            setLoadState('error')
            setErrorMessage(LOAD_ERROR)
          }
          return current
        })
      })
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  useEffect(() => {
    function handleLibraryUpdated(): void {
      void fetchStats({ silent: true })
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [fetchStats])

  const chromeCount =
    loadState === 'ready' && stats
      ? `${stats.totalGames} ${stats.totalGames === 1 ? 'game' : 'games'}`
      : '…'

  return (
    <AppShell column>
      <AppChrome
        left={<AppNav page={page} onNavigate={onNavigate} />}
        right={
          <span className="app-chrome__count library-chrome__count" aria-live="polite">
            {chromeCount}
          </span>
        }
      />

      {loadState === 'loading' && (
        <div
          className="dashboard-page dashboard-page--loading"
          aria-busy="true"
          aria-labelledby="dashboard-loading-status"
        >
          <p
            id="dashboard-loading-status"
            className="dashboard-page__loading"
            role="status"
            aria-live="polite"
          >
            Loading profile…
          </p>
          <DashboardSkeleton />
        </div>
      )}

      {loadState === 'error' && (
        <div className="dashboard-page dashboard-page--state">
          <div className="dashboard-page__error" role="alert">
            <p className="dashboard-page__error-text">{errorMessage ?? LOAD_ERROR}</p>
            <Chip variant="action" onClick={() => void fetchStats()}>
              Retry
            </Chip>
          </div>
        </div>
      )}

      {loadState === 'ready' && stats && (
        <DashboardContent stats={stats} onNavigate={onNavigate} onSelectGame={onSelectGame} />
      )}
    </AppShell>
  )
}

function DashboardSkeleton(): React.ReactElement {
  return (
    <>
      <section className="dashboard-hero dashboard-hero--skeleton" aria-hidden="true">
        <div className="dashboard-skeleton dashboard-skeleton--ring" />
        <div className="dashboard-skeleton dashboard-skeleton--snapshot" />
      </section>
      <section className="dashboard-shelf dashboard-shelf--skeleton" aria-hidden="true">
        <div className="dashboard-skeleton dashboard-skeleton--shelf-legend" />
      </section>
      <section className="dashboard-momentum dashboard-momentum--skeleton" aria-hidden="true">
        <div className="dashboard-skeleton dashboard-skeleton--momentum" />
      </section>
    </>
  )
}

function LevelProgressRing({
  level,
  levelPct
}: {
  level: number
  levelPct: number
}): React.ReactElement {
  const size = 120
  const stroke = 6
  const radius = size / 2 - stroke / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (levelPct / 100) * circumference

  return (
    <svg
      className="dashboard-level-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Level ${level}, ${levelPct}% progress to next level`}
    >
      <circle className="dashboard-level-ring__track" cx={size / 2} cy={size / 2} r={radius} />
      <circle
        className="dashboard-level-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text
        className="dashboard-level-ring__label"
        x="50%"
        y="46%"
        dominantBaseline="central"
        textAnchor="middle"
        aria-hidden
      >
        {level}
      </text>
      <text
        className="dashboard-level-ring__sublabel"
        x="50%"
        y="62%"
        dominantBaseline="central"
        textAnchor="middle"
        aria-hidden
      >
        LVL
      </text>
    </svg>
  )
}

function DashboardContent({
  stats,
  onNavigate,
  onSelectGame
}: {
  stats: ProfileStats
  onNavigate: (page: AppPage) => void
  onSelectGame?: (appid: string) => void
}): React.ReactElement {
  const { level, xpInLevel, xpToNext, levelPct } = computeLevelProgress(stats.xp)
  const maxCount = Math.max(...stats.monthlyActivity.map((m) => m.count), 1)
  const shelfTotal = TIER_SHELF.reduce((sum, item) => sum + (stats[item.key] as number), 0)
  const hasUnlocks = stats.totalUnlocked > 0

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero" aria-labelledby="dashboard-progress-heading">
        <div className="dashboard-hero__progress">
          <h2 id="dashboard-progress-heading" className="visually-hidden">
            Progress
          </h2>
          <LevelProgressRing level={level} levelPct={levelPct} />
          <div className="dashboard-hero__xp">
            <p className="dashboard-hero__xp-primary">
              <span className="dashboard-hero__xp-value">{xpInLevel.toLocaleString()}</span>
              <span className="dashboard-hero__xp-sep">/</span>
              <span className="dashboard-hero__xp-total">{XP_PER_LEVEL.toLocaleString()} XP</span>
              <HelpTip content={TOOLTIPS.xp} label="XP help" />
            </p>
            <p className="dashboard-hero__xp-secondary">
              {xpToNext.toLocaleString()} XP to level {level + 1}
              <HelpTip content={TOOLTIPS.level} label="Level help" />
            </p>
            <p className="dashboard-hero__xp-total-earned">
              {stats.xp.toLocaleString()} XP earned total
            </p>
          </div>
        </div>

        <div className="dashboard-hero__snapshot">
          <h3 className="dashboard-hero__snapshot-title">Library snapshot</h3>
          <dl className="dashboard-snapshot">
            <div className="dashboard-snapshot__row">
              <dt className="dashboard-snapshot__label dashboard-stat-label">
                Games
                <HelpTip content={TOOLTIPS.gamesStat} label="Games help" />
              </dt>
              <dd className="dashboard-snapshot__value">{stats.totalGames.toLocaleString()}</dd>
            </div>
            <div className="dashboard-snapshot__row">
              <dt className="dashboard-snapshot__label dashboard-stat-label">
                Unlocked
                <HelpTip content={TOOLTIPS.unlockedStat} label="Unlocked help" />
              </dt>
              <dd className="dashboard-snapshot__value dashboard-snapshot__value--progress">
                {stats.totalUnlocked.toLocaleString()}
              </dd>
            </div>
            <div className="dashboard-snapshot__row">
              <dt className="dashboard-snapshot__label dashboard-stat-label">
                Avg completion
                <HelpTip content={TOOLTIPS.libraryCompletion} label="Library completion help" />
              </dt>
              <dd className="dashboard-snapshot__value">{stats.libraryCompletionPct}%</dd>
            </div>
            <div className="dashboard-snapshot__row">
              <dt className="dashboard-snapshot__label dashboard-stat-label">
                Unlocks / game
                <HelpTip content={TOOLTIPS.unlocksPerGame} label="Unlocks per game help" />
              </dt>
              <dd className="dashboard-snapshot__value">
                {unlocksPerGame(stats.totalUnlocked, stats.totalGames)}
              </dd>
            </div>
            {stats.totalPlaytimeSeconds > 0 && (
              <div className="dashboard-snapshot__row">
                <dt className="dashboard-snapshot__label dashboard-stat-label">
                  Playtime
                  <HelpTip content={TOOLTIPS.playtimeStat} label="Playtime help" />
                </dt>
                <dd className="dashboard-snapshot__value">
                  {formatTotalPlaytime(stats.totalPlaytimeSeconds)}
                </dd>
              </div>
            )}
          </dl>
          <Chip variant="action" onClick={() => onNavigate('library')}>
            Open Library
          </Chip>
        </div>
      </section>

      <section className="dashboard-shelf" aria-labelledby="dashboard-shelf-heading">
        <h2 id="dashboard-shelf-heading" className="dashboard-section-title">
          Trophy shelf
        </h2>
        {shelfTotal === 0 ? (
          <div className="dashboard-page__empty-block">
            <p className="dashboard-page__empty-title">No trophies yet</p>
            <p className="dashboard-page__empty">{EMPTY_STATES.noMonthlyActivity}</p>
            <Chip variant="action" onClick={() => onNavigate('library')}>
              Open Library
            </Chip>
          </div>
        ) : (
          <dl className="dashboard-shelf__legend">
            {TIER_SHELF.map((item) => (
              <div
                key={item.key}
                className={`dashboard-shelf__legend-item dashboard-shelf__legend-item--${item.tier}`}
              >
                <dt className="dashboard-shelf__legend-label dashboard-stat-label">
                  {item.label}
                  <HelpTip content={item.tip} label={`${item.label} help`} />
                </dt>
                <dd className="dashboard-shelf__legend-value">
                  {(stats[item.key] as number).toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="dashboard-momentum" aria-labelledby="dashboard-momentum-heading">
        <h2 id="dashboard-momentum-heading" className="dashboard-section-title">
          Momentum
          <HelpTip content={TOOLTIPS.monthlyActivity} label="Momentum help" />
        </h2>

        {!hasUnlocks ? (
          <div className="dashboard-page__empty-block">
            <p className="dashboard-page__empty-title">No unlocks yet</p>
            <p className="dashboard-page__empty">{EMPTY_STATES.noMonthlyActivity}</p>
          </div>
        ) : (
          <div className="dashboard-momentum__grid">
            <div className="dashboard-momentum__activity">
              <h3 className="dashboard-momentum__subhead">Monthly unlocks</h3>
              {stats.monthlyActivity.length === 0 ? (
                <p className="dashboard-page__empty">No dated unlocks in save files yet.</p>
              ) : (
                <>
                  <ul className="visually-hidden" aria-label="Monthly unlock counts">
                    {stats.monthlyActivity.map((m) => (
                      <li key={m.month}>
                        {formatActivityMonth(m.month)}: {unlockCountLabel(m.count)}
                      </li>
                    ))}
                  </ul>
                  <div className="dashboard-activity dashboard-activity--compact" aria-hidden="true">
                    {stats.monthlyActivity.map((m, index) => {
                      const heightPct =
                        m.count > 0
                          ? Math.max(Math.round((m.count / maxCount) * 100), 4)
                          : 0
                      return (
                        <div key={m.month} className="dashboard-activity__column">
                          <div className="dashboard-activity__bar-track">
                            <div
                              className="dashboard-activity__bar"
                              style={{ '--bar-height': `${heightPct}%` } as React.CSSProperties}
                              title={`${formatActivityMonth(m.month)}: ${unlockCountLabel(m.count)}`}
                            >
                              <div
                                className="dashboard-activity__bar-fill"
                                style={
                                  { '--bar-index': String(index) } as React.CSSProperties
                                }
                              />
                            </div>
                          </div>
                          <span className="dashboard-activity__label">{m.month.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="dashboard-momentum__aside">
              {stats.recentUnlocks.length > 0 && (
                <div className="dashboard-recent">
                  <h3 className="dashboard-momentum__subhead" id="dashboard-recent-heading">
                    Recent unlocks
                  </h3>
                  <div
                    className="dashboard-recent__scroll"
                    role="region"
                    aria-labelledby="dashboard-recent-heading"
                    tabIndex={0}
                  >
                    <ul className="dashboard-recent__list">
                      {stats.recentUnlocks.map((unlock) => (
                        <li key={`${unlock.appid}-${unlock.earnedAt}-${unlock.achievementName}`}>
                          {onSelectGame ? (
                            <button
                              type="button"
                              className={`dashboard-recent__row dashboard-recent__row--${unlock.tier}`}
                              onClick={() => onSelectGame(unlock.appid)}
                            >
                              <RecentUnlockContent unlock={unlock} />
                            </button>
                          ) : (
                            <div
                              className={`dashboard-recent__row dashboard-recent__row--${unlock.tier}`}
                            >
                              <RecentUnlockContent unlock={unlock} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {stats.nearCompletionGames.length > 0 && (
                <div className="dashboard-near">
                  <h3 className="dashboard-momentum__subhead">Close to done</h3>
                  <ul className="dashboard-near__list">
                    {stats.nearCompletionGames.map((game) => (
                      <li key={game.appid}>
                        {onSelectGame ? (
                          <button
                            type="button"
                            className="dashboard-near__row"
                            onClick={() => onSelectGame(game.appid)}
                          >
                            <NearCompletionContent game={game} />
                          </button>
                        ) : (
                          <div className="dashboard-near__row">
                            <NearCompletionContent game={game} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function RecentUnlockContent({
  unlock
}: {
  unlock: ProfileStats['recentUnlocks'][number]
}): React.ReactElement {
  return (
    <>
      <span className={`dashboard-recent__tier dashboard-recent__tier--${unlock.tier}`}>
        {unlock.tier}
      </span>
      <span className="dashboard-recent__body">
        <span className="dashboard-recent__name">{unlock.achievementName}</span>
        <span className="dashboard-recent__meta">
          {unlock.gameName} · {formatUnlockDate(unlock.earnedAt)}
        </span>
      </span>
    </>
  )
}

function NearCompletionContent({
  game
}: {
  game: ProfileStats['nearCompletionGames'][number]
}): React.ReactElement {
  return (
    <>
      <span className="dashboard-near__name">{game.name}</span>
      <span className="dashboard-near__pct">{game.completionPct}%</span>
    </>
  )
}
