import React, { useEffect, useMemo, useState } from 'react'
import type { Achievement, GameDetail, TrophyTier } from '../../../shared/types'
import {
  type ActiveFilter,
  type DisplayTier,
  type PlatinumEntry,
  achievementDescription,
  achievementIconSrc,
  countEarnedInTier,
  getTierGroup,
  groupAchievementsByTier,
  isHiddenAchievement,
  isPlatinumEntry,
  tierLabel
} from '../lib/achievementDisplay'

interface Props {
  appid: string
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
}

type TierVarKey = TrophyTier | 'platinum'

const TIER_VAR: Record<TierVarKey, string> = {
  platinum: 'var(--tier-platinum)',
  gold: 'var(--tier-gold)',
  silver: 'var(--tier-silver)',
  bronze: 'var(--tier-bronze)'
}

const FILTER_OPTIONS: Array<{ id: ActiveFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'platinum', label: 'Platinum' },
  { id: 'gold', label: 'Gold' },
  { id: 'silver', label: 'Silver' },
  { id: 'bronze', label: 'Bronze' }
]

function formatUnlockDate(unixSeconds: number): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function CompletionRing({
  pct,
  platinum,
  size = 56,
  large = false
}: {
  pct: number
  platinum: boolean
  size?: number
  large?: boolean
}): React.ReactElement {
  const stroke = large ? 6 : 4
  const radius = size / 2 - stroke / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const rounded = Math.round(pct)
  const label = `${rounded}% complete${platinum ? ', platinum earned' : ''}`

  return (
    <svg
      className={`game-detail__completion-ring${large ? ' game-detail__completion-ring--large' : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      <circle className="game-detail__completion-ring__track" cx={size / 2} cy={size / 2} r={radius} />
      <circle
        className={`game-detail__completion-ring__fill ${
          platinum
            ? 'game-detail__completion-ring__fill--platinum'
            : 'game-detail__completion-ring__fill--progress'
        }`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text
        className={`game-detail__completion-ring__label ${
          platinum ? 'game-detail__completion-ring__label--platinum' : ''
        }`}
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        aria-hidden
      >
        {rounded}%
      </text>
    </svg>
  )
}

function GameDetailHeroBar({
  onBack,
  onRefresh,
  refreshing
}: {
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
}): React.ReactElement {
  return (
    <div className="game-detail__hero-bar">
      <button type="button" className="game-detail__pill game-detail__back" onClick={onBack}>
        <span className="game-detail__back-icon" aria-hidden>
          ←
        </span>
        Library
      </button>
      <button
        type="button"
        className="game-detail__pill game-detail__hero-action"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}

function GameDetailSkeleton({
  onBack,
  onRefresh,
  refreshing
}: {
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
}): React.ReactElement {
  return (
    <div className="game-detail game-detail--loading" aria-busy="true" aria-label="Loading game details">
      <div className="game-detail__backdrop game-detail__backdrop--placeholder" aria-hidden>
        <div className="game-detail__backdrop-overlay" />
      </div>
      <div className="game-detail__content">
        <header className="game-detail__hero">
          <GameDetailHeroBar onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
          <div className="game-detail__hero-content">
            <div className="game-detail__hero-left">
              <div className="game-detail__skeleton game-detail__skeleton--title" />
            </div>
            <div className="game-detail__hero-right">
              <div className="game-detail__skeleton game-detail__skeleton--ring" />
              <div className="game-detail__skeleton game-detail__skeleton--meta" />
            </div>
          </div>
        </header>
        <div className="game-detail__body">
          <div className="game-detail__skeleton game-detail__skeleton--section" />
          <div className="game-detail__list">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="game-detail__skeleton game-detail__skeleton--row" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TierHeader({
  tier,
  earnedCount,
  totalCount
}: {
  tier: DisplayTier
  earnedCount: number
  totalCount: number
}): React.ReactElement {
  const earnedLabel = tier === 'platinum' ? (earnedCount === 1 ? 'earned' : 'locked') : `${earnedCount} earned`

  return (
    <li className={`game-detail__tier-header game-detail__tier-header--${tier}`} aria-hidden>
      <span className="game-detail__tier-header__label">{tierLabel(tier)}</span>
      <span className="game-detail__tier-header__meta">
        {tier === 'platinum' ? earnedLabel : `${earnedLabel} · ${totalCount} total`}
      </span>
    </li>
  )
}

function PlatinumRow({
  entry,
  lastUnlockedAt
}: {
  entry: PlatinumEntry
  lastUnlockedAt: number
}): React.ReactElement {
  const earned = entry.earned
  const unlockDate = earned ? formatUnlockDate(lastUnlockedAt) : null
  const subtitle = earned
    ? unlockDate
      ? `All achievements unlocked · ${unlockDate}`
      : 'All achievements unlocked'
    : 'Unlock all achievements to earn this'

  return (
    <li
      className="achievement-row achievement-row--platinum"
      data-earned={earned ? 'true' : 'false'}
      data-tier="platinum"
      style={{ '--row-tier': TIER_VAR.platinum } as React.CSSProperties}
    >
      <div className="achievement-row__icon-wrap">
        <div className="achievement-row__platinum-icon" aria-hidden>
          ✦
        </div>
      </div>
      <div className="achievement-row__body">
        <div className="achievement-row__name">Platinum Trophy</div>
        <div className={`achievement-row__desc${earned ? '' : ' achievement-row__desc--placeholder'}`}>
          {subtitle}
        </div>
      </div>
      <div className="achievement-row__aside">
        <span className="achievement-row__tier-pill achievement-row__tier-pill--platinum">platinum</span>
        <div className="achievement-row__rarity">App exclusive</div>
      </div>
    </li>
  )
}

function AchievementRow({
  ach,
  appid,
  showDescriptions
}: {
  ach: Achievement
  appid: string
  showDescriptions: boolean
}): React.ReactElement {
  const desc = achievementDescription(ach.description, ach.hidden ?? 0, ach.earned, showDescriptions)
  const isHidden = isHiddenAchievement(ach.hidden)
  const earned = ach.earned === 1
  const tierVar = TIER_VAR[ach.trophy_tier]
  const unlockDate = earned ? formatUnlockDate(ach.earned_time) : null
  const rarityLabel =
    ach.global_percent > 0 ? `${ach.global_percent.toFixed(1)}% of players` : 'No rarity data'

  return (
    <li
      className="achievement-row"
      data-earned={earned ? 'true' : 'false'}
      data-tier={ach.trophy_tier}
      style={
        {
          '--row-tier': tierVar,
          opacity: earned ? 1 : isHidden ? 0.65 : 0.5
        } as React.CSSProperties
      }
    >
      <div className="achievement-row__icon-wrap">
        <img
          className="achievement-row__icon"
          src={achievementIconSrc(appid, ach.earned, ach.icon_url, ach.icon_gray_url)}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      </div>
      <div className="achievement-row__body">
        <div className="achievement-row__name" title={ach.display_name}>
          {ach.display_name}
          {isHidden && <span className="achievement-row__hidden-tag">Hidden</span>}
        </div>
        {desc && (
          <div
            className={`achievement-row__desc ${
              desc === 'Hidden achievement' ? 'achievement-row__desc--placeholder' : ''
            }`}
            title={desc !== 'Hidden achievement' ? desc : undefined}
          >
            {desc}
          </div>
        )}
        {unlockDate && <div className="achievement-row__unlocked">Unlocked {unlockDate}</div>}
      </div>
      <div className="achievement-row__aside">
        <span className={`achievement-row__tier-pill achievement-row__tier-pill--${ach.trophy_tier}`}>
          {ach.trophy_tier}
        </span>
        <div className="achievement-row__rarity" title="Global unlock rate on Steam">
          {rarityLabel}
        </div>
      </div>
    </li>
  )
}

function renderListItem(
  item: Achievement | PlatinumEntry,
  appid: string,
  showDescriptions: boolean,
  lastUnlockedAt: number
): React.ReactElement {
  if (isPlatinumEntry(item)) {
    return <PlatinumRow key="platinum" entry={item} lastUnlockedAt={lastUnlockedAt} />
  }
  return (
    <AchievementRow key={item.api_name} ach={item} appid={appid} showDescriptions={showDescriptions} />
  )
}

export default function GameDetailPage({
  appid,
  onBack,
  onRefresh,
  refreshing
}: Props): React.ReactElement {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDescriptions, setShowDescriptions] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [resolvedBackdrop, setResolvedBackdrop] = useState('')

  useEffect(() => {
    setError(null)
    setDetail(null)
    setActiveFilter('all')
    setResolvedBackdrop('')
    window.api
      .getGameDetail(appid)
      .then(setDetail)
      .catch(() => setError('Could not load game details. Try Refresh from the toolbar.'))
  }, [appid])

  useEffect(() => {
    if (!detail) {
      setResolvedBackdrop('')
      return
    }

    const fallback = detail.cover_url
    const candidate = detail.backdrop_url

    if (!candidate) {
      setResolvedBackdrop(fallback)
      return
    }

    setResolvedBackdrop(fallback)

    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setResolvedBackdrop(candidate)
    }
    img.onerror = () => {
      if (!cancelled) setResolvedBackdrop(fallback)
    }
    img.src = candidate

    return () => {
      cancelled = true
    }
  }, [detail])

  const tierGroups = useMemo(() => {
    if (!detail) return []
    return groupAchievementsByTier(
      detail.achievements,
      detail.game.has_platinum === 1,
      detail.game.name
    )
  }, [detail])

  if (error) {
    return (
      <div className="game-detail">
        <div className="game-detail__content">
          <header className="game-detail__hero game-detail__hero--compact">
            <GameDetailHeroBar onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
          </header>
          <div className="game-detail__body">
            <p className="game-detail__error" role="alert">
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!detail) {
    return <GameDetailSkeleton onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
  }

  const { game, achievements } = detail
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum === 1
  const hasHiddenUnearned = achievements.some(
    (a) => isHiddenAchievement(a.hidden) && !a.earned
  )
  const hiddenUnearnedCount = achievements.filter(
    (a) => isHiddenAchievement(a.hidden) && !a.earned
  ).length

  const backdropStyle = resolvedBackdrop
    ? { backgroundImage: `url(${resolvedBackdrop})` }
    : undefined

  const visibleFilters = FILTER_OPTIONS.filter((opt) => {
    if (opt.id === 'all') return true
    if (opt.id === 'platinum') return game.total_achievements > 0
    const group = getTierGroup(tierGroups, opt.id)
    return group !== undefined && group.items.length > 0
  })

  const filteredGroup =
    activeFilter === 'all' ? null : getTierGroup(tierGroups, activeFilter)

  return (
    <div className="game-detail">
      <div
        className={`game-detail__backdrop${resolvedBackdrop ? '' : ' game-detail__backdrop--placeholder'}`}
        style={backdropStyle}
        aria-hidden
      >
        <div className="game-detail__backdrop-overlay" />
      </div>

      <div className="game-detail__content">
        <header className="game-detail__hero">
          <GameDetailHeroBar onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
          <div className="game-detail__hero-content">
            <div className="game-detail__hero-left">
              <h2 className="game-detail__title">{game.name}</h2>
            </div>
            <div className="game-detail__hero-right">
              <CompletionRing pct={completionPct} platinum={hasPlatinum} size={96} large />
              <p className="game-detail__meta game-detail__meta--hero">
                <span className="game-detail__meta-strong">
                  {game.unlocked_achievements} / {game.total_achievements}
                </span>
                <span className="game-detail__meta-label">achievements</span>
              </p>
              <div
                className="game-detail__progress-track game-detail__progress-track--hero"
                role="progressbar"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${completionPct}% complete`}
              >
                <div
                  className={`game-detail__progress-fill ${
                    hasPlatinum
                      ? 'game-detail__progress-fill--platinum'
                      : 'game-detail__progress-fill--progress'
                  }`}
                  style={{ '--bar-width': `${completionPct}%` } as React.CSSProperties}
                />
              </div>
              {hasPlatinum && <span className="game-detail__platinum-badge">✦ Platinum</span>}
            </div>
          </div>
        </header>

        <div className="game-detail__body">
          <div className="game-detail__toolbar">
            <h3 className="game-detail__section-title">
              Achievements
              <span className="game-detail__section-count">{achievements.length}</span>
            </h3>
          </div>

          {achievements.length > 0 && (
            <div className="game-detail__filter-bar" role="group" aria-label="Filter achievements by tier">
              {visibleFilters.map((opt) => {
                const group = opt.id === 'all' ? undefined : getTierGroup(tierGroups, opt.id)
                const earnedCount =
                  opt.id === 'all'
                    ? achievements.filter((a) => a.earned === 1).length + (hasPlatinum ? 1 : 0)
                    : countEarnedInTier(group, opt.id)
                const isActive = activeFilter === opt.id
                const tierClass =
                  opt.id !== 'all' ? ` game-detail__filter-btn--${opt.id}` : ''

                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`game-detail__filter-btn${tierClass}${
                      isActive ? ' game-detail__filter-btn--active' : ''
                    }`}
                    aria-pressed={isActive}
                    onClick={() => setActiveFilter(opt.id)}
                  >
                    {opt.label}
                    <span className="game-detail__filter-btn__count">{earnedCount}</span>
                  </button>
                )
              })}
              {hasHiddenUnearned && (
                <button
                  type="button"
                  className={`game-detail__filter-btn game-detail__filter-btn--hidden${
                    showDescriptions ? ' game-detail__filter-btn--active' : ''
                  }`}
                  aria-pressed={showDescriptions}
                  aria-label={
                    showDescriptions
                      ? 'Hide hidden achievement descriptions'
                      : 'Show hidden achievement descriptions'
                  }
                  onClick={() => setShowDescriptions((v) => !v)}
                >
                  Hidden
                  <span className="game-detail__filter-btn__count">{hiddenUnearnedCount}</span>
                </button>
              )}
            </div>
          )}

          {achievements.length === 0 ? (
            <p className="game-detail__empty">
              No achievements are loaded for this game yet. Refresh the library to fetch Steam metadata.
            </p>
          ) : (
            <ul className="game-detail__list">
              {activeFilter === 'all'
                ? tierGroups.flatMap((group) => {
                    const earnedCount = countEarnedInTier(group, group.tier)
                    const totalCount =
                      group.tier === 'platinum' ? 1 : group.items.length

                    return [
                      <TierHeader
                        key={`header-${group.tier}`}
                        tier={group.tier}
                        earnedCount={earnedCount}
                        totalCount={totalCount}
                      />,
                      ...group.items.map((item) =>
                        renderListItem(item, game.appid, showDescriptions, game.last_unlocked_at)
                      )
                    ]
                  })
                : filteredGroup?.items.map((item) =>
                    renderListItem(item, game.appid, showDescriptions, game.last_unlocked_at)
                  )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
