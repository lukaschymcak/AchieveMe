import React, { useEffect, useMemo, useState } from 'react'
import type { GameSummary } from '../../../shared/types'
import SteamApiKeyForm from '../components/SteamApiKeyForm'
import { filterAndSortGames, type SortOption } from '../lib/libraryUtils'

type AppPage = 'dashboard' | 'library' | 'settings'
type ViewMode = 'grid' | 'list'

const LIBRARY_VIEW_MODE_KEY = 'library-view-mode'

function readStoredViewMode(): ViewMode {
  const stored = localStorage.getItem(LIBRARY_VIEW_MODE_KEY)
  return stored === 'list' ? 'list' : 'grid'
}

interface Props {
  onSelect: (appid: string) => void
  onGoToSettings?: () => void
  page: AppPage
  onNavigate: (page: AppPage) => void
  onRefresh: () => void
  refreshing: boolean
  onDisplayedGamesChange?: (games: GameSummary[]) => void
}

const NAV_ITEMS: Array<{ id: AppPage; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'library', label: 'Library' },
  { id: 'settings', label: 'Settings' }
]

const SORT_OPTIONS: Array<{ id: SortOption; label: string; shortLabel: string }> = [
  { id: 'completion-asc', label: 'Least complete', shortLabel: 'Least' },
  { id: 'unlocked-desc', label: 'Most unlocked', shortLabel: 'Most' },
  { id: 'recent', label: 'Recently unlocked', shortLabel: 'Recent' }
]

export default function LibraryPage({
  onSelect,
  onGoToSettings,
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
  const [deleteMode, setDeleteMode] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<GameSummary | null>(null)
  const [deletingAppid, setDeletingAppid] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode)

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

  function exitDeleteMode(): void {
    setDeleteMode(false)
    setPendingDelete(null)
  }

  async function handleDelete(appid: string): Promise<void> {
    setDeletingAppid(appid)
    try {
      await window.api.deleteGame(appid)
      setGames((prev) => prev.filter((g) => g.appid !== appid))
      exitDeleteMode()
    } finally {
      setDeletingAppid(null)
    }
  }

  function handleCardClick(game: GameSummary): void {
    if (deleteMode) {
      setPendingDelete(game)
      return
    }
    onSelect(game.appid)
  }

  if (hasApiKey === null) {
    return (
      <div className="library library--centered">
        <p className="library__status">Loading…</p>
      </div>
    )
  }

  if (!hasApiKey) {
    return (
      <div className="library library--centered">
        <SteamApiKeyForm prominent onSaved={handleKeySaved} />
        {onGoToSettings && (
          <p className="library__settings-hint">
            Or configure it in{' '}
            <button type="button" className="library__link-btn" onClick={onGoToSettings}>
              Settings
            </button>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`library${deleteMode ? ' library--delete-mode' : ''}`}>
      <div className="library-chrome-wrap">
        <header className="library-chrome">
          <div className="library-chrome__left">
          <nav className="library-chrome__nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`library-chip library-chip--nav${
                  page === item.id ? ' library-chip--active' : ''
                }`}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="library-chrome__sorts" role="group" aria-label="Sort games">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`library-chip${
                  sort === option.id ? ' library-chip--active' : ''
                }`}
                aria-pressed={sort === option.id}
                title={option.label}
                onClick={() => setSort(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="library-chrome__search-wrap">
          <label className="library-chrome__search-label" htmlFor="library-search">
            <span className="visually-hidden">Search games</span>
          </label>
          <input
            id="library-search"
            type="search"
            className="library-chrome__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            autoComplete="off"
          />
        </div>

        <div className="library-chrome__right">
          <span className="library-chrome__count" aria-live="polite">
            {displayedGames.length} {displayedGames.length === 1 ? 'game' : 'games'}
          </span>
          <button
            type="button"
            className={`library-chip library-chip--danger${
              deleteMode ? ' library-chip--danger-active' : ''
            }`}
            aria-pressed={deleteMode}
            onClick={() => {
              if (deleteMode) exitDeleteMode()
              else setDeleteMode(true)
            }}
          >
            {deleteMode ? 'Cancel' : 'Delete'}
          </button>
          <button
            type="button"
            className="library-chip library-chip--action"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        </header>

        <div className="library-chrome__toolbar">
          <button
            type="button"
            className="library-view-toggle"
            onClick={() => setViewMode((mode) => (mode === 'grid' ? 'list' : 'grid'))}
            aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            title={viewMode === 'grid' ? 'List view' : 'Grid view'}
          >
            {viewMode === 'grid' ? <ViewListIcon /> : <ViewGridIcon />}
          </button>
        </div>
      </div>

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
        <p className="library__status library__status--empty">
          No games found. Make sure your emulator save folders exist, then click Refresh.
        </p>
      ) : displayedGames.length === 0 ? (
        <p className="library__status library__status--empty">No games match your search.</p>
      ) : viewMode === 'list' ? (
        <ul className="library__list">
          {displayedGames.map((game) => (
            <GameListRow
              key={game.appid}
              game={game}
              isPending={pendingDelete?.appid === game.appid}
              deleting={deletingAppid === game.appid}
              onRowClick={() => handleCardClick(game)}
              onConfirmDelete={() => handleDelete(game.appid)}
              onCancelDelete={() => setPendingDelete(null)}
            />
          ))}
        </ul>
      ) : (
        <div className="library__grid">
          {displayedGames.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              isPending={pendingDelete?.appid === game.appid}
              deleting={deletingAppid === game.appid}
              onCardClick={() => handleCardClick(game)}
              onConfirmDelete={() => handleDelete(game.appid)}
              onCancelDelete={() => setPendingDelete(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GameCard({
  game,
  isPending,
  deleting,
  onCardClick,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  isPending: boolean
  deleting: boolean
  onCardClick: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum

  return (
    <article
      className={`library-card${hasPlatinum ? ' library-card--platinum' : ''}${
        isPending ? ' library-card--pending' : ''
      }${deleting ? ' library-card--deleting' : ''}`}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${completionPct} percent complete`}
    >
      {isPending && (
        <div
          className="library-card__confirm"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby={`delete-title-${game.appid}`}
        >
          <p id={`delete-title-${game.appid}`} className="library-card__confirm-title">
            Delete this game?
          </p>
          <p className="library-card__confirm-name">{game.name}</p>
          <p className="library-card__confirm-hint">Removes the game and its save folder from disk.</p>
          <div className="library-card__confirm-actions">
            <button
              type="button"
              className="library-chip library-chip--danger-active"
              onClick={onConfirmDelete}
              disabled={deleting}
            >
              Delete
            </button>
            <button
              type="button"
              className="library-chip"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        </div>
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
  isPending,
  deleting,
  onRowClick,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  isPending: boolean
  deleting: boolean
  onRowClick: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum

  return (
    <li
      className={`library-list-row${hasPlatinum ? ' library-list-row--platinum' : ''}${
        isPending ? ' library-list-row--pending' : ''
      }${deleting ? ' library-list-row--deleting' : ''}`}
      onClick={onRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${completionPct} percent complete`}
    >
      {isPending && (
        <div
          className="library-list-row__confirm"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby={`delete-title-list-${game.appid}`}
        >
          <p id={`delete-title-list-${game.appid}`} className="library-list-row__confirm-title">
            Delete this game?
          </p>
          <p className="library-list-row__confirm-name">{game.name}</p>
          <p className="library-list-row__confirm-hint">Removes the game and its save folder from disk.</p>
          <div className="library-list-row__confirm-actions">
            <button
              type="button"
              className="library-chip library-chip--danger-active"
              onClick={onConfirmDelete}
              disabled={deleting}
            >
              Delete
            </button>
            <button
              type="button"
              className="library-chip"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        </div>
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

function ViewListIcon(): React.ReactElement {
  return (
    <svg className="library-view-toggle__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="2" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="7" width="13" height="2" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="11.5" width="13" height="2" rx="0.75" fill="currentColor" />
    </svg>
  )
}

function ViewGridIcon(): React.ReactElement {
  return (
    <svg className="library-view-toggle__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="0.75" fill="currentColor" />
    </svg>
  )
}
