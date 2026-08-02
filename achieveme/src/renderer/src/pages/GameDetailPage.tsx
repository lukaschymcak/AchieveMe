import React, { useEffect, useMemo, useState } from 'react'
import type { Achievement, GameDetail, GameExecutable, TrophyTier } from '../../../shared/types'
import { LAUNCH_NEEDS_EXE } from '../../../shared/types'
import { formatPlaytimePlayed } from '../../../shared/playtimeUtils'
import { getSteamLibraryHeroUrl } from '../../../shared/steamUrls'
import HelpTip from '../components/HelpTip'
import { TOOLTIPS, getEmptyAchievementsMessage } from '../lib/helpContent'
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
  onPrev: (() => void) | null
  onNext: (() => void) | null
  transitionDir: 'next' | 'prev' | null
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
      <span className="game-detail__refresh-wrap">
      <button
        type="button"
        className="game-detail__pill game-detail__hero-action"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing…' : 'Refresh all'}
      </button>
      <HelpTip content={TOOLTIPS.refreshGameDetail} label="Refresh library help" />
      </span>
    </div>
  )
}

function GameDetailNavArrows({
  onPrev,
  onNext
}: {
  onPrev: (() => void) | null
  onNext: (() => void) | null
}): React.ReactElement {
  return (
    <>
      {onPrev && (
        <button
          type="button"
          className="game-detail__nav-arrow game-detail__nav-arrow--prev"
          onClick={onPrev}
          aria-label="Previous game"
          title={TOOLTIPS.navArrows}
        >
          <span className="game-detail__nav-arrow-glyph" aria-hidden>
            ‹
          </span>
        </button>
      )}
      {onNext && (
        <button
          type="button"
          className="game-detail__nav-arrow game-detail__nav-arrow--next"
          onClick={onNext}
          aria-label="Next game"
          title={TOOLTIPS.navArrows}
        >
          <span className="game-detail__nav-arrow-glyph" aria-hidden>
            ›
          </span>
        </button>
      )}
    </>
  )
}

function GameDetailSkeletonContent({
  onBack,
  onRefresh,
  refreshing
}: {
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
}): React.ReactElement {
  return (
    <>
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
    </>
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
  const hasProgress = !earned && (ach.max_progress ?? 0) > 0
  const progressPct = hasProgress
    ? Math.min(100, Math.round(((ach.progress ?? 0) / (ach.max_progress ?? 1)) * 100))
    : 0

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
        {hasProgress && (
          <div
            className="achievement-row__progress-track"
            role="progressbar"
            aria-valuenow={ach.progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={ach.max_progress ?? 0}
            aria-label={`${ach.progress ?? 0} of ${ach.max_progress ?? 0}`}
          >
            <div
              className="achievement-row__progress-fill"
              style={{ '--bar-width': `${progressPct}%` } as React.CSSProperties}
            />
            <span className="achievement-row__progress-label">
              {ach.progress ?? 0} / {ach.max_progress ?? 0}
            </span>
          </div>
        )}
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
  refreshing,
  onPrev,
  onNext,
  transitionDir
}: Props): React.ReactElement {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDescriptions, setShowDescriptions] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [resolvedBackdrop, setResolvedBackdrop] = useState('')
  const [exePickerOpen, setExePickerOpen] = useState(false)
  const [exeOptions, setExeOptions] = useState<GameExecutable[]>([])
  const [exePickerError, setExePickerError] = useState('')
  const [exeRootLabel, setExeRootLabel] = useState('')
  const [playBusy, setPlayBusy] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [playMenuOpen, setPlayMenuOpen] = useState(false)
  const [rootConfirmPath, setRootConfirmPath] = useState<string | null>(null)
  const [playGamesFromLauncher, setPlayGamesFromLauncher] = useState(true)
  const [hasApiKey, setHasApiKey] = useState(false)

  async function reloadDetail(): Promise<GameDetail | null> {
    const next = await window.api.getGameDetail(appid)
    setDetail(next)
    return next
  }

  function showExePicker(root: string, list: GameExecutable[]): void {
    setRootConfirmPath(null)
    setExeRootLabel(root)
    setExeOptions(list)
    setExePickerError(list.length === 0 ? 'No executables found in this folder.' : '')
    setExePickerOpen(true)
  }

  async function browseAndListExecutables(): Promise<void> {
    const folder = await window.api.browseGameInstallFolder()
    if (!folder) return
    await window.api.setGameLaunchConfig({
      appid,
      installPath: folder,
      launchExe: detail?.game.launch_exe ?? ''
    })
    await reloadDetail()
    const list = await window.api.listGameExecutables(folder)
    showExePicker(folder, list)
  }

  async function openExeResolveFlow(acceptedRoot?: string): Promise<void> {
    setExePickerError('')
    setPlayMenuOpen(false)

    const result = await window.api.resolveGameExecutables(appid, acceptedRoot)
    if (result.status === 'ready') {
      showExePicker(result.root, result.executables)
      return
    }
    if (result.status === 'confirm_root') {
      setExePickerOpen(false)
      setRootConfirmPath(result.candidatePath)
      return
    }

    await browseAndListExecutables()
  }

  async function ensureInstallThenResolve(): Promise<void> {
    const installPath = detail?.game.install_path?.trim() ?? ''
    if (!installPath) {
      await browseAndListExecutables()
      return
    }
    await openExeResolveFlow()
  }

  async function handlePlay(): Promise<void> {
    if (playBusy) return
    setPlayBusy(true)
    setPlayMenuOpen(false)
    try {
      const hasExe = Boolean(detail?.game.launch_exe?.trim())
      if (!hasExe) {
        await ensureInstallThenResolve()
        return
      }
      setIsLaunching(true)
      await window.api.launchGame(appid)
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      const message = err instanceof Error ? err.message : String(err)
      if (
        code === LAUNCH_NEEDS_EXE ||
        message.includes(LAUNCH_NEEDS_EXE) ||
        /Select a game executable/i.test(message)
      ) {
        await ensureInstallThenResolve()
      } else {
        setError(message)
      }
    } finally {
      setIsLaunching(false)
      setPlayBusy(false)
    }
  }

  async function handleChangeExecutable(): Promise<void> {
    setPlayMenuOpen(false)
    await ensureInstallThenResolve()
  }

  async function handleConfirmRoot(yes: boolean): Promise<void> {
    const candidate = rootConfirmPath
    setRootConfirmPath(null)
    if (!candidate) return
    if (yes) {
      await openExeResolveFlow(candidate)
      return
    }
    await browseAndListExecutables()
  }

  async function handlePickExecutable(exe: GameExecutable): Promise<void> {
    setPlayBusy(true)
    try {
      await window.api.setGameLaunchConfig({
        appid,
        installPath: detail?.game.install_path || undefined,
        launchExe: exe.absolutePath
      })
      setExePickerOpen(false)
      await reloadDetail()
    } catch (err) {
      setExePickerError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlayBusy(false)
    }
  }

  useEffect(() => {
    setError(null)
    setDetail(null)
    setActiveFilter('all')
    setExePickerOpen(false)
    setPlayMenuOpen(false)
    setRootConfirmPath(null)
    setIsLaunching(false)
    window.api
      .getSettings()
      .then((settings) => {
        setPlayGamesFromLauncher(settings.playGamesFromLauncher)
        setHasApiKey(settings.steamApiKey.trim().length > 0)
      })
      .catch(() => {
        setPlayGamesFromLauncher(true)
        setHasApiKey(false)
      })
    window.api
      .getGameDetail(appid)
      .then(setDetail)
      .catch(() => setError('Could not load game details. Try Refresh all from the toolbar.'))
  }, [appid])

  useEffect(() => {
    function handleLibraryUpdated(payload: { appid?: string }): void {
      if (payload.appid && payload.appid !== appid) return
      window.api
        .getGameDetail(appid)
        .then(setDetail)
        .catch(() => setError('Could not load game details. Try Refresh all from the toolbar.'))
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [appid])

  useEffect(() => {
    let cancelled = false
    const heroUrl = getSteamLibraryHeroUrl(appid)

    const applyCoverFallback = (): void => {
      void window.api.getGameDetail(appid).then((d) => {
        if (!cancelled && d?.cover_url) setResolvedBackdrop(d.cover_url)
      })
    }

    setResolvedBackdrop('')

    if (!heroUrl) {
      applyCoverFallback()
      return () => {
        cancelled = true
      }
    }

    const img = new Image()
    img.onload = () => {
      if (!cancelled) setResolvedBackdrop(heroUrl)
    }
    img.onerror = () => {
      if (!cancelled) applyCoverFallback()
    }
    img.src = heroUrl

    return () => {
      cancelled = true
    }
  }, [appid])

  const tierGroups = useMemo(() => {
    if (!detail) return []
    return groupAchievementsByTier(
      detail.achievements,
      detail.game.has_platinum === 1,
      detail.game.name
    )
  }, [detail])

  const backdropStyle = resolvedBackdrop
    ? { backgroundImage: `url(${resolvedBackdrop})` }
    : undefined

  const isLoading = !detail && !error
  const game = detail?.game
  const achievements = detail?.achievements ?? []
  const completionPct = game ? Math.round(game.completion_pct) : 0
  const hasPlatinum = game?.has_platinum === 1
  const playtimeLabel = game ? formatPlaytimePlayed(game.playtime_seconds ?? 0) : null
  const hasInstallPath = Boolean(game?.install_path?.trim())
  const hasLaunchExe = Boolean(game?.launch_exe?.trim())
  const playLabel = isLaunching
    ? 'Starting…'
    : hasLaunchExe
      ? 'Play'
      : hasInstallPath
        ? 'Select exe'
        : 'Set install folder'
  const playAriaLabel = !game
    ? 'Play'
    : hasLaunchExe
      ? `Play ${game.name}`
      : hasInstallPath
        ? `Select executable for ${game.name}`
        : `Set install folder for ${game.name}`
  const hasHiddenUnearned = achievements.some(
    (a) => isHiddenAchievement(a.hidden) && !a.earned
  )
  const hiddenUnearnedCount = achievements.filter(
    (a) => isHiddenAchievement(a.hidden) && !a.earned
  ).length
  const visibleFilters = game
    ? FILTER_OPTIONS.filter((opt) => {
        if (opt.id === 'all') return true
        if (opt.id === 'platinum') return game.total_achievements > 0
        const group = getTierGroup(tierGroups, opt.id)
        return group !== undefined && group.items.length > 0
      })
    : []
  const filteredGroup =
    activeFilter === 'all' || !game ? null : getTierGroup(tierGroups, activeFilter)

  return (
    <div className={`game-detail${isLoading ? ' game-detail--loading' : ''}`}>
      <GameDetailNavArrows onPrev={onPrev} onNext={onNext} />
      <div
        className="game-detail__backdrop"
        style={backdropStyle}
        aria-hidden
      >
        <div className="game-detail__backdrop-overlay" />
      </div>

      <div
        key={appid}
        className="game-detail-transition"
        data-dir={transitionDir ?? ''}
      >
        <div
          className="game-detail__content"
          aria-busy={isLoading || undefined}
          aria-label={isLoading ? 'Loading game details' : undefined}
        >
          {error ? (
            <>
              <header className="game-detail__hero game-detail__hero--compact">
                <GameDetailHeroBar onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
              </header>
              <div className="game-detail__body">
                <p className="game-detail__error" role="alert">
                  {error}
                </p>
              </div>
            </>
          ) : !detail ? (
            <GameDetailSkeletonContent
              onBack={onBack}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          ) : (
            <>
              <header className="game-detail__hero">
                <GameDetailHeroBar onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} />
                <div className="game-detail__hero-content">
                  <div className="game-detail__hero-left">
                    <div className="game-detail__title-row">
                      <h2 className="game-detail__title">{game!.name}</h2>
                      {playGamesFromLauncher && (
                      <div className="game-detail__play-group">
                        <button
                          type="button"
                          className="game-detail__pill game-detail__play"
                          onClick={() => void handlePlay()}
                          disabled={playBusy}
                          aria-label={playAriaLabel}
                        >
                          {playLabel}
                        </button>
                        <div className="game-detail__play-menu-wrap">
                          <button
                            type="button"
                            className="game-detail__pill game-detail__play-chevron"
                            onClick={() => setPlayMenuOpen((open) => !open)}
                            aria-label="Play options"
                            aria-expanded={playMenuOpen}
                            aria-haspopup="menu"
                            disabled={playBusy}
                          >
                            ▾
                          </button>
                          {playMenuOpen && (
                            <div className="game-detail__play-menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                className="game-detail__play-menu-item"
                                onClick={() => void handleChangeExecutable()}
                              >
                                Change executable…
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                  <div className="game-detail__hero-right">
                    <CompletionRing pct={completionPct} platinum={hasPlatinum} size={96} large />
                    <p className="game-detail__meta game-detail__meta--hero">
                      <span className="game-detail__meta-strong">
                        {game!.unlocked_achievements} / {game!.total_achievements}
                      </span>
                      <span className="game-detail__meta-label">achievements</span>
                    </p>
                    {playtimeLabel != null && (
                      <p className="game-detail__meta game-detail__meta--playtime">{playtimeLabel}</p>
                    )}
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
                      <span className="game-detail__filter-hidden-wrap">
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
                          title={TOOLTIPS.hiddenFilter}
                          onClick={() => setShowDescriptions((v) => !v)}
                        >
                          Hidden
                          <span className="game-detail__filter-btn__count">{hiddenUnearnedCount}</span>
                        </button>
                        <HelpTip content={TOOLTIPS.hiddenFilter} label="Hidden achievements help" />
                      </span>
                    )}
                  </div>
                )}

                {achievements.length === 0 ? (
                  <p className="game-detail__empty">
                    {getEmptyAchievementsMessage(hasApiKey, game?.schema_fetched_at ?? 0)}
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
                              renderListItem(
                                item,
                                game!.appid,
                                showDescriptions,
                                game!.last_unlocked_at
                              )
                            )
                          ]
                        })
                      : filteredGroup?.items.map((item) =>
                          renderListItem(
                            item,
                            game!.appid,
                            showDescriptions,
                            game!.last_unlocked_at
                          )
                        )}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {playGamesFromLauncher && rootConfirmPath && (
        <div
          className="game-detail__exe-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRootConfirmPath(null)
          }}
        >
          <div
            className="game-detail__exe-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm game folder"
          >
            <div className="game-detail__exe-modal-header">
              <h3 className="game-detail__exe-modal-title">Is this the game&apos;s folder?</h3>
              <button
                type="button"
                className="game-detail__pill"
                onClick={() => setRootConfirmPath(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="game-detail__exe-modal-help">
              The folder name is only a possible match for this game. Confirm to search it for
              executables, or pick another folder.
            </p>
            <p className="game-detail__exe-modal-path" title={rootConfirmPath}>
              {rootConfirmPath}
            </p>
            <div className="game-detail__exe-confirm-actions">
              <button
                type="button"
                className="game-detail__pill game-detail__play"
                disabled={playBusy}
                onClick={() => void handleConfirmRoot(true)}
              >
                Yes, use this folder
              </button>
              <button
                type="button"
                className="game-detail__pill"
                disabled={playBusy}
                onClick={() => void handleConfirmRoot(false)}
              >
                No, browse…
              </button>
            </div>
          </div>
        </div>
      )}

      {playGamesFromLauncher && exePickerOpen && (
        <div
          className="game-detail__exe-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExePickerOpen(false)
          }}
        >
          <div
            className="game-detail__exe-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select game executable"
          >
            <div className="game-detail__exe-modal-header">
              <h3 className="game-detail__exe-modal-title">Select executable</h3>
              <button
                type="button"
                className="game-detail__pill"
                onClick={() => setExePickerOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="game-detail__exe-modal-help">
              Choose the game&apos;s main .exe anywhere under the game folder.
            </p>
            {exeRootLabel && (
              <p className="game-detail__exe-modal-path" title={exeRootLabel}>
                {exeRootLabel}
              </p>
            )}
            {exePickerError && (
              <p className="game-detail__exe-modal-error">{exePickerError}</p>
            )}
            <ul className="game-detail__exe-list">
              {exeOptions.map((exe) => (
                <li key={exe.absolutePath}>
                  <button
                    type="button"
                    className="game-detail__exe-option"
                    disabled={playBusy}
                    onClick={() => void handlePickExecutable(exe)}
                  >
                    <span className="game-detail__exe-option-name">{exe.name}</span>
                    {exe.relativePath !== exe.name && (
                      <span className="game-detail__exe-option-path">{exe.relativePath}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
