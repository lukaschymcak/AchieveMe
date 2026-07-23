import React, { useEffect, useMemo, useState } from 'react'
import type { GameSummary } from '../../../shared/types'
import { formatPlaytimeCompact } from '../../../shared/playtimeUtils'
import SteamApiKeyForm from '../components/SteamApiKeyForm'
import AddGameModal from '../components/AddGameModal'
import GameCardMenu, { type GameCardMenuMode } from '../components/GameCardMenu'
import GameCardHoldOverlay from '../components/GameCardHoldOverlay'
import HelpTip from '../components/HelpTip'
import LibraryCoachMark from '../components/LibraryCoachMark'
import {
  AppChrome,
  AppNav,
  AppSearchInput,
  AppShell,
  AppToolbarButton,
  Chip
} from '../components/app'
import { shouldShowLongPressHint } from '../lib/helpStorage'
import { useLongPress } from '../hooks/useLongPress'
import type { AppPage } from '../lib/appNavigation'
import { filterAndSortGames, type SortOption } from '../lib/libraryUtils'
import { EMPTY_STATES, TOOLTIPS } from '../lib/helpContent'

type ViewMode = 'grid' | 'list'

const LIBRARY_VIEW_MODE_KEY = 'library-view-mode'

function readStoredViewMode(): ViewMode {
  const stored = localStorage.getItem(LIBRARY_VIEW_MODE_KEY)
  return stored === 'list' ? 'list' : 'grid'
}

interface Props {
  onSelect: (appid: string) => void
  onGoToSettings?: () => void
  onGoToHelp?: () => void
  page: AppPage
  onNavigate: (page: AppPage) => void
  onRefresh: () => void
  refreshing: boolean
  onDisplayedGamesChange?: (games: GameSummary[]) => void
}

const SORT_OPTIONS: Array<{ id: SortOption; label: string; shortLabel: string }> = [
  { id: 'completion-asc', label: 'Least complete', shortLabel: 'Least' },
  { id: 'unlocked-desc', label: 'Most unlocked', shortLabel: 'Most' },
  { id: 'recent', label: 'Recently unlocked', shortLabel: 'Recent' }
]

export default function LibraryPage({
  onSelect,
  onGoToSettings,
  onGoToHelp,
  page,
  onNavigate,
  onRefresh,
  refreshing,
  onDisplayedGamesChange
}: Props): React.ReactElement {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('unlocked-desc')
  const [menuAppid, setMenuAppid] = useState<string | null>(null)
  const [menuMode, setMenuMode] = useState<GameCardMenuMode>('actions')
  const [deletingAppid, setDeletingAppid] = useState<string | null>(null)
  const [refreshingAppid, setRefreshingAppid] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLongPressHint, setShowLongPressHint] = useState(() => shouldShowLongPressHint())

  useEffect(() => {
    localStorage.setItem(LIBRARY_VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    window.api.getSettings().then((settings) => {
      const keySet = settings.steamApiKey.trim().length > 0
      setHasApiKey(keySet)
      if (keySet) {
        setLoading(true)
        window.api
          .getAllGames()
          .then(setGames)
          .finally(() => setLoading(false))
      }
    })
  }, [])

  useEffect(() => {
    if (hasApiKey !== true) return

    function handleLibraryUpdated(): void {
      void reloadGames()
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [hasApiKey])

  useEffect(() => {
    if (!menuAppid) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuAppid])

  const displayedGames = useMemo(
    () => filterAndSortGames(games, search, sort),
    [games, search, sort]
  )

  useEffect(() => {
    onDisplayedGamesChange?.(displayedGames)
  }, [displayedGames, onDisplayedGamesChange])

  function handleKeySaved(): void {
    setHasApiKey(true)
    setLoading(true)
    window.api
      .getAllGames()
      .then(setGames)
      .finally(() => setLoading(false))
  }

  function closeMenu(): void {
    setMenuAppid(null)
    setMenuMode('actions')
  }

  function openMenu(appid: string): void {
    setMenuAppid(appid)
    setMenuMode('actions')
  }

  async function reloadGames(): Promise<void> {
    const updated = await window.api.getAllGames()
    setGames(updated)
  }

  async function handleDelete(appid: string): Promise<void> {
    setDeletingAppid(appid)
    try {
      await window.api.deleteGame(appid)
      setGames((prev) => prev.filter((g) => g.appid !== appid))
      closeMenu()
    } finally {
      setDeletingAppid(null)
    }
  }

  async function handleRefreshGame(appid: string): Promise<void> {
    setRefreshingAppid(appid)
    try {
      await window.api.refreshGame(appid)
      await reloadGames()
      closeMenu()
    } finally {
      setRefreshingAppid(null)
    }
  }

  if (hasApiKey === null) {
    return (
      <AppShell centered>
        <p className="library__status">Loading…</p>
      </AppShell>
    )
  }

  if (!hasApiKey) {
    return (
      <AppShell centered>
        <SteamApiKeyForm prominent onSaved={handleKeySaved} />
        {onGoToSettings && (
          <p className="library__settings-hint">
            Or configure it in{' '}
            <button type="button" className="library__link-btn" onClick={onGoToSettings}>
              Settings
            </button>
            {onGoToHelp && (
              <>
                {' '}
                ·{' '}
                <button type="button" className="library__link-btn" onClick={onGoToHelp}>
                  Help
                </button>
              </>
            )}
          </p>
        )}
      </AppShell>
    )
  }

  return (
    <AppShell>
      <AppChrome
        left={
          <>
            <AppNav page={page} onNavigate={onNavigate} />
            <div
              className="app-chrome__sorts library-chrome__sorts"
              role="group"
              aria-label="Sort games"
            >
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  active={sort === option.id}
                  aria-pressed={sort === option.id}
                  title={option.label}
                  aria-label={option.label}
                  onClick={() => setSort(option.id)}
                >
                  {option.shortLabel}
                </Chip>
              ))}
            </div>
          </>
        }
        center={
          <>
            <label className="app-chrome__search-label library-chrome__search-label" htmlFor="library-search">
              <span className="visually-hidden">Search games</span>
            </label>
            <AppSearchInput
              id="library-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games…"
              autoComplete="off"
              title={TOOLTIPS.search}
            />
          </>
        }
        right={
          <>
            <span className="app-chrome__count library-chrome__count" aria-live="polite">
              {displayedGames.length} {displayedGames.length === 1 ? 'game' : 'games'}
            </span>
            <span className="app-chrome__refresh-wrap library-chrome__refresh-wrap">
              <Chip variant="action" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </Chip>
              <HelpTip content={TOOLTIPS.refreshLibrary} label="Refresh library help" />
            </span>
          </>
        }
        toolbar={
          <>
            <AppToolbarButton
              onClick={() => setShowAddModal(true)}
              aria-label="Set up Goldberg emulator for a new game"
              title={TOOLTIPS.addGame}
            >
              <PlusIcon />
            </AppToolbarButton>
            <AppToolbarButton
              onClick={() => setViewMode((mode) => (mode === 'grid' ? 'list' : 'grid'))}
              aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              title={TOOLTIPS.gridList}
            >
              {viewMode === 'grid' ? <ViewListIcon /> : <ViewGridIcon />}
            </AppToolbarButton>
          </>
        }
      />

      {loading ? (
        viewMode === 'list' ? (
          <ul className="library__list library__list--loading" aria-busy="true" aria-label="Loading library">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="library-list-row library-list-row--skeleton" />
            ))}
          </ul>
        ) : (
          <div className="library__grid library__grid--loading" aria-busy="true" aria-label="Loading library">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="library-card library-card--skeleton" />
            ))}
          </div>
        )
      ) : games.length === 0 ? (
        <div className="library__status library__status--empty library__status--empty-block">
          <strong>{EMPTY_STATES.noGames.title}</strong>
          {EMPTY_STATES.noGames.body}
        </div>
      ) : displayedGames.length === 0 ? (
        <p className="library__status library__status--empty">{EMPTY_STATES.noSearchMatch}</p>
      ) : viewMode === 'list' ? (
        <ul className="library__list">
          {displayedGames.map((game) => (
            <GameListRow
              key={game.appid}
              game={game}
              menuOpen={menuAppid === game.appid}
              menuMode={menuAppid === game.appid ? menuMode : 'actions'}
              deleting={deletingAppid === game.appid}
              refreshing={refreshingAppid === game.appid}
              onOpenMenu={() => openMenu(game.appid)}
              onCloseMenu={closeMenu}
              onOpen={() => {
                closeMenu()
                onSelect(game.appid)
              }}
              onRefresh={() => handleRefreshGame(game.appid)}
              onDelete={() => setMenuMode('confirm-delete')}
              onConfirmDelete={() => handleDelete(game.appid)}
              onCancelDelete={() => setMenuMode('actions')}
            />
          ))}
        </ul>
      ) : (
        <div className="library__grid">
          {displayedGames.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              menuOpen={menuAppid === game.appid}
              menuMode={menuAppid === game.appid ? menuMode : 'actions'}
              deleting={deletingAppid === game.appid}
              refreshing={refreshingAppid === game.appid}
              onOpenMenu={() => openMenu(game.appid)}
              onCloseMenu={closeMenu}
              onOpen={() => {
                closeMenu()
                onSelect(game.appid)
              }}
              onRefresh={() => handleRefreshGame(game.appid)}
              onDelete={() => setMenuMode('confirm-delete')}
              onConfirmDelete={() => handleDelete(game.appid)}
              onCancelDelete={() => setMenuMode('actions')}
            />
          ))}
        </div>
      )}

      {hasApiKey && !loading && showLongPressHint && (
        <LibraryCoachMark onDismiss={() => setShowLongPressHint(false)} />
      )}

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onGameAdded={() => {
            setShowAddModal(false)
            setLoading(true)
            window.api
              .getAllGames()
              .then(setGames)
              .finally(() => setLoading(false))
          }}
        />
      )}
    </AppShell>
  )
}

function GameCard({
  game,
  menuOpen,
  menuMode,
  deleting,
  refreshing,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  menuOpen: boolean
  menuMode: GameCardMenuMode
  deleting: boolean
  refreshing: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onOpen: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum

  const { isHolding, holdDurationMs, ...longPressHandlers } = useLongPress({
    onLongPress: onOpenMenu,
    onShortPress: onOpen,
    disabled: menuOpen
  })

  return (
    <article
      className={`library-card${hasPlatinum ? ' library-card--platinum' : ''}${
        menuOpen ? ' library-card--menu-open' : ''
      }${isHolding ? ' library-card--holding' : ''}${deleting ? ' library-card--deleting' : ''}`}
      {...longPressHandlers}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${formatPlaytimeCompact(game.playtime_seconds ?? 0)} playtime, ${completionPct} percent complete`}
    >
      <GameCardHoldOverlay
        classPrefix="library-card"
        isHolding={isHolding}
        menuOpen={menuOpen}
        holdDurationMs={holdDurationMs}
      />

      {menuOpen && (
        <GameCardMenu
          gameName={game.name}
          mode={menuMode}
          deleting={deleting}
          refreshing={refreshing}
          classPrefix="library-card"
          onOpen={onOpen}
          onRefresh={onRefresh}
          onDelete={onDelete}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
          onClose={onCloseMenu}
        />
      )}

      <div className="library-card__media">
        {game.cover_url ? (
          <img className="library-card__cover" src={game.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="library-card__cover library-card__cover--placeholder">{game.name}</div>
        )}
        <div className="library-card__scrim" aria-hidden />
        <div className="library-card__overlay">
          <div className="library-card__main">
            <h3 className="library-card__title">{game.name}</h3>
            <div className="library-card__stats">
              <span className="library-card__fraction">
                {game.unlocked_achievements}/{game.total_achievements}
              </span>
              <span className="library-card__playtime" aria-hidden>
                · {formatPlaytimeCompact(game.playtime_seconds ?? 0)}
              </span>
              {hasPlatinum && <span className="library-card__platinum">✦ Platinum</span>}
            </div>
            <div
              className="library-card__progress"
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${completionPct}% complete`}
            >
              <div
                className={`library-card__progress-fill${
                  hasPlatinum ? ' library-card__progress-fill--platinum' : ''
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <span className="library-card__pct" aria-hidden>
            {completionPct}%
          </span>
        </div>
      </div>
    </article>
  )
}

function GameListRow({
  game,
  menuOpen,
  menuMode,
  deleting,
  refreshing,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  menuOpen: boolean
  menuMode: GameCardMenuMode
  deleting: boolean
  refreshing: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onOpen: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum

  const { isHolding, holdDurationMs, ...longPressHandlers } = useLongPress({
    onLongPress: onOpenMenu,
    onShortPress: onOpen,
    disabled: menuOpen
  })

  return (
    <li
      className={`library-list-row${hasPlatinum ? ' library-list-row--platinum' : ''}${
        menuOpen ? ' library-list-row--menu-open' : ''
      }${isHolding ? ' library-list-row--holding' : ''}${deleting ? ' library-list-row--deleting' : ''}`}
      {...longPressHandlers}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${formatPlaytimeCompact(game.playtime_seconds ?? 0)} playtime, ${completionPct} percent complete`}
    >
      <GameCardHoldOverlay
        classPrefix="library-list-row"
        isHolding={isHolding}
        menuOpen={menuOpen}
        holdDurationMs={holdDurationMs}
      />

      {menuOpen && (
        <GameCardMenu
          gameName={game.name}
          mode={menuMode}
          deleting={deleting}
          refreshing={refreshing}
          classPrefix="library-list-row"
          onOpen={onOpen}
          onRefresh={onRefresh}
          onDelete={onDelete}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
          onClose={onCloseMenu}
        />
      )}

      <div className="library-list-row__thumb-wrap">
        {game.cover_url ? (
          <img className="library-list-row__thumb" src={game.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="library-list-row__thumb library-list-row__thumb--placeholder">{game.name}</div>
        )}
      </div>

      <div className="library-list-row__body">
        <h3 className="library-list-row__name">{game.name}</h3>
        <div className="library-list-row__meta" aria-hidden>
          <span className="library-list-row__fraction">
            {game.unlocked_achievements}/{game.total_achievements}
          </span>
          <span className="library-list-row__playtime">
            · {formatPlaytimeCompact(game.playtime_seconds ?? 0)}
          </span>
          {hasPlatinum && <span className="library-list-row__platinum">✦ Platinum</span>}
        </div>
        <div
          className="library-list-row__progress"
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${completionPct}% complete`}
        >
          <div
            className={`library-list-row__progress-fill${
              hasPlatinum ? ' library-list-row__progress-fill--platinum' : ''
            }`}
            style={{ '--bar-width': `${completionPct}%`, width: `${completionPct}%` } as React.CSSProperties}
          />
        </div>
      </div>

      <span className="library-list-row__pct" aria-hidden>
        {completionPct}%
      </span>
    </li>
  )
}

function PlusIcon(): React.ReactElement {
  return (
    <svg className="app-toolbar-btn__icon library-view-toggle__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="7" y="2" width="2" height="12" rx="1" fill="currentColor" />
      <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

function ViewListIcon(): React.ReactElement {
  return (
    <svg className="app-toolbar-btn__icon library-view-toggle__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="2" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="7" width="13" height="2" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="11.5" width="13" height="2" rx="0.75" fill="currentColor" />
    </svg>
  )
}

function ViewGridIcon(): React.ReactElement {
  return (
    <svg className="app-toolbar-btn__icon library-view-toggle__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
    </svg>
  )
}
