import React, { useEffect, useMemo, useState } from 'react'
import type { AppSettings, GameSummary, WantedGame } from '../../../shared/types'
import { LAUNCH_NEEDS_EXE } from '../../../shared/types'
import { formatPlaytimeCompact } from '../../../shared/playtimeUtils'
import { wantedStoreUrl } from '../../../shared/wantedGamesUtils'
import SteamApiKeyForm from '../components/SteamApiKeyForm'
import AddGameModal from '../components/AddGameModal'
import AddToLibraryPickerModal from '../components/AddToLibraryPickerModal'
import AddWantedModal from '../components/AddWantedModal'
import WantedRail from '../components/WantedRail'
import GameCardMenu, {
  type GameCardMenuMode,
  type MenuPosition
} from '../components/GameCardMenu'
import HelpTip from '../components/HelpTip'
import LibraryCoachMark from '../components/LibraryCoachMark'
import {
  AppChrome,
  AppNav,
  AppShell,
  AppToolbarButton,
  Chip
} from '../components/app'
import { shouldShowLongPressHint } from '../lib/helpStorage'
import { useLongPress, type PointerPosition } from '../hooks/useLongPress'
import type { AppPage } from '../lib/appNavigation'
import { filterAndSortGames, type SortOption } from '../lib/libraryUtils'
import { EMPTY_STATES, TOOLTIPS } from '../lib/helpContent'
import {
  listLibraryOpenFolderCandidates,
  shouldShowOpenFolder
} from '../../../shared/libraryContextMenuUtils'

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
  onOpenDepotWizard?: (prefill?: { appid: string; name: string }) => void
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
  onDisplayedGamesChange,
  onOpenDepotWizard
}: Props): React.ReactElement {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<SortOption>('unlocked-desc')
  const [menuAppid, setMenuAppid] = useState<string | null>(null)
  const [menuMode, setMenuMode] = useState<GameCardMenuMode>('actions')
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [deletingAppid, setDeletingAppid] = useState<string | null>(null)
  const [refreshingAppid, setRefreshingAppid] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addGamePrefill, setAddGamePrefill] = useState<{ appid: string; name: string } | null>(null)
  const [showLongPressHint, setShowLongPressHint] = useState(() => shouldShowLongPressHint())
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [launchingAppid, setLaunchingAppid] = useState<string | null>(null)
  const [wantedGames, setWantedGames] = useState<WantedGame[]>([])
  const [wantedLoading, setWantedLoading] = useState(false)
  const [showAddWantedModal, setShowAddWantedModal] = useState(false)
  const [showPickerModal, setShowPickerModal] = useState(false)
  const [pickerGame, setPickerGame] = useState<WantedGame | null>(null)

  useEffect(() => {
    localStorage.setItem(LIBRARY_VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  async function loadWantedGames(): Promise<void> {
    setWantedLoading(true)
    try {
      const list = await window.api.listWantedGames()
      setWantedGames(list)
    } finally {
      setWantedLoading(false)
    }
  }

  useEffect(() => {
    void loadWantedGames()
  }, [])

  useEffect(() => {
    window.api.getSettings().then((next) => {
      setSettings(next)
      const keySet = next.steamApiKey.trim().length > 0
      setHasApiKey(keySet)
      if (keySet) {
        setLoading(true)
        window.api
          .getAllGames()
          .then((list) => {
            setGames(list)
            void window.api.warmHunterLibrary().catch(() => undefined)
          })
          .finally(() => setLoading(false))
      }
    })
  }, [])

  async function handlePlayGamesFromLauncherChange(enabled: boolean): Promise<void> {
    if (!settings) return
    const next = { ...settings, playGamesFromLauncher: enabled }
    setSettings(next)
    await window.api.saveSettings(next)
  }

  async function handleLibraryPlay(game: GameSummary): Promise<void> {
    if (!(settings?.playGamesFromLauncher ?? true) || launchingAppid) return
    if (!game.launch_exe?.trim()) {
      closeMenu()
      onSelect(game.appid)
      return
    }
    setLaunchingAppid(game.appid)
    try {
      await window.api.launchGame(game.appid)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.includes(LAUNCH_NEEDS_EXE) ||
        /Select a game executable/i.test(message)
      ) {
        closeMenu()
        onSelect(game.appid)
      }
    } finally {
      setLaunchingAppid(null)
    }
  }

  useEffect(() => {
    function handleLibraryUpdated(): void {
      if (hasApiKey === true) {
        void reloadGames()
      }
      void loadWantedGames()
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [hasApiKey])

  useEffect(() => {
    if (!menuAppid) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeMenu()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuAppid])

  const displayedGames = useMemo(
    () => filterAndSortGames(games, '', sort),
    [games, sort]
  )

  useEffect(() => {
    onDisplayedGamesChange?.(displayedGames)
  }, [displayedGames, onDisplayedGamesChange])

  function handleKeySaved(): void {
    setHasApiKey(true)
    setLoading(true)
    window.api
      .getAllGames()
      .then((list) => {
        setGames(list)
        void window.api.warmHunterLibrary().catch(() => undefined)
      })
      .finally(() => setLoading(false))
  }

  function closeMenu(): void {
    setMenuAppid(null)
    setMenuMode('actions')
    setMenuPosition(null)
  }

  async function handleRemoveWanted(appid: string): Promise<void> {
    await window.api.removeWantedGame(appid)
    setWantedGames((prev) => prev.filter((g) => g.appid !== appid))
  }

  function handleOpenWantedStore(appid: string): void {
    window.open(wantedStoreUrl(appid), '_blank', 'noreferrer')
  }

  function handleAddWantedToLibrary(game: WantedGame): void {
    setPickerGame(game)
    setShowPickerModal(true)
  }

  function closePicker(): void {
    setShowPickerModal(false)
    setPickerGame(null)
  }

  function handlePickerInstalled(): void {
    if (!pickerGame) return
    setAddGamePrefill({ appid: pickerGame.appid, name: pickerGame.name })
    closePicker()
    setShowAddModal(true)
  }

  function handlePickerDepot(): void {
    const prefill = pickerGame
      ? { appid: pickerGame.appid, name: pickerGame.name }
      : undefined
    closePicker()
    onOpenDepotWizard?.(prefill)
  }

  function handleCloseAddGameModal(): void {
    setShowAddModal(false)
    setAddGamePrefill(null)
  }

  function handleAddGameAdded(): void {
    handleCloseAddGameModal()
    setLoading(true)
    window.api
      .getAllGames()
      .then(setGames)
      .finally(() => setLoading(false))
    void loadWantedGames()
  }

  function openMenu(appid: string, position: MenuPosition): void {
    setMenuAppid(appid)
    setMenuMode('actions')
    setMenuPosition(position)
  }

  async function handleOpenFolder(game: GameSummary): Promise<void> {
    const candidates = listLibraryOpenFolderCandidates(
      game.install_path ?? '',
      game.launch_exe ?? ''
    )
    if (candidates.length === 0) return
    if (typeof window.api.openPath !== 'function') {
      console.error('Open folder failed: window.api.openPath is unavailable (restart the app).')
      return
    }
    try {
      await window.api.openPath(candidates)
      closeMenu()
    } catch (err) {
      console.error('Open folder failed:', err)
    }
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
        left={<AppNav page={page} onNavigate={onNavigate} />}
        center={
          <WantedRail
            games={wantedGames}
            loading={wantedLoading}
            onAddWanted={() => setShowAddWantedModal(true)}
            onAddToLibrary={handleAddWantedToLibrary}
            onRemove={(appid) => void handleRemoveWanted(appid)}
            onOpenStore={handleOpenWantedStore}
          />
        }
        right={
          <>
            <span className="app-chrome__count library-chrome__count" aria-live="polite">
              {displayedGames.length + (displayedGames.length === 1 ? ' game' : ' games')}
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
            <div
              className="app-chrome__sorts library-chrome__sorts library-chrome__toolbar-sorts"
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
            <label className="library-launcher-toggle" title={TOOLTIPS.playGamesFromLauncher}>
              <input
                type="checkbox"
                className="library-launcher-toggle__checkbox"
                checked={settings?.playGamesFromLauncher ?? true}
                disabled={settings == null}
                onChange={(e) => void handlePlayGamesFromLauncherChange(e.target.checked)}
              />
              <span className="library-launcher-toggle__label">Play games from launcher</span>
            </label>
            <div className="library-chrome__toolbar-actions">
              <AppToolbarButton
                onClick={() => {
                  setAddGamePrefill(null)
                  setShowAddModal(true)
                }}
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
            </div>
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
              menuPosition={menuAppid === game.appid ? menuPosition : null}
              deleting={deletingAppid === game.appid}
              refreshing={refreshingAppid === game.appid}
              showPlay={settings?.playGamesFromLauncher ?? true}
              launching={launchingAppid === game.appid}
              onOpenMenu={(position) => openMenu(game.appid, position)}
              onCloseMenu={closeMenu}
              onOpen={() => {
                closeMenu()
                onSelect(game.appid)
              }}
              onPlay={() => void handleLibraryPlay(game)}
              onOpenFolder={() => void handleOpenFolder(game)}
              onRefresh={() => void handleRefreshGame(game.appid)}
              onDelete={() => setMenuMode('confirm-delete')}
              onConfirmDelete={() => void handleDelete(game.appid)}
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
              menuPosition={menuAppid === game.appid ? menuPosition : null}
              deleting={deletingAppid === game.appid}
              refreshing={refreshingAppid === game.appid}
              showPlay={settings?.playGamesFromLauncher ?? true}
              launching={launchingAppid === game.appid}
              onOpenMenu={(position) => openMenu(game.appid, position)}
              onCloseMenu={closeMenu}
              onOpen={() => {
                closeMenu()
                onSelect(game.appid)
              }}
              onPlay={() => void handleLibraryPlay(game)}
              onOpenFolder={() => void handleOpenFolder(game)}
              onRefresh={() => void handleRefreshGame(game.appid)}
              onDelete={() => setMenuMode('confirm-delete')}
              onConfirmDelete={() => void handleDelete(game.appid)}
              onCancelDelete={() => setMenuMode('actions')}
            />
          ))}
        </div>
      )}

      {hasApiKey && !loading && showLongPressHint && (
        <LibraryCoachMark onDismiss={() => setShowLongPressHint(false)} />
      )}

      {showPickerModal && pickerGame && (
        <AddToLibraryPickerModal
          game={pickerGame}
          onInstalled={handlePickerInstalled}
          onDepot={handlePickerDepot}
          onClose={closePicker}
        />
      )}
      {showAddModal && (
        <AddGameModal
          prefill={addGamePrefill ?? undefined}
          onClose={handleCloseAddGameModal}
          onGameAdded={handleAddGameAdded}
        />
      )}
      {showAddWantedModal && (
        <AddWantedModal
          onClose={() => setShowAddWantedModal(false)}
          onAdded={() => {
            setShowAddWantedModal(false)
            void loadWantedGames()
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
  menuPosition,
  deleting,
  refreshing,
  showPlay,
  launching,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onPlay,
  onOpenFolder,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  menuOpen: boolean
  menuMode: GameCardMenuMode
  menuPosition: MenuPosition | null
  deleting: boolean
  refreshing: boolean
  showPlay: boolean
  launching: boolean
  onOpenMenu: (position: MenuPosition) => void
  onCloseMenu: () => void
  onOpen: () => void
  onPlay: () => void
  onOpenFolder: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum
  const hasExe = Boolean(game.launch_exe?.trim())
  const playLabel = launching ? 'Starting…' : hasExe ? 'Play' : 'Set up Play'
  const showFolder = shouldShowOpenFolder(game.install_path ?? '', game.launch_exe ?? '')

  const { ...longPressHandlers } = useLongPress({
    onLongPress: (position: PointerPosition) => onOpenMenu(position),
    onShortPress: onOpen,
    disabled: menuOpen
  })

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    onOpenMenu({ x: e.clientX, y: e.clientY })
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
      return
    }
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      onOpenMenu({ x: rect.left, y: rect.bottom })
    }
  }

  return (
    <article
      className={`library-card${hasPlatinum ? ' library-card--platinum' : ''}${
        menuOpen ? ' library-card--menu-open' : ''
      }${deleting ? ' library-card--deleting' : ''}`}
      {...longPressHandlers}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${formatPlaytimeCompact(game.playtime_seconds ?? 0)} playtime, ${completionPct} percent complete${
        game.has_depot_gids && game.update_status === 'update_available' ? ', update available' : ''
      }`}
    >
      {menuOpen && menuPosition && (
        <GameCardMenu
          gameName={game.name}
          mode={menuMode}
          deleting={deleting}
          refreshing={refreshing}
          launching={launching}
          showPlay={showPlay}
          hasExe={hasExe}
          showOpenFolder={showFolder}
          position={menuPosition}
          classPrefix="library-card"
          onPlay={onPlay}
          onOpen={onOpen}
          onOpenFolder={onOpenFolder}
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
        {game.has_depot_gids && game.update_status === 'update_available' && (
          <span className="library-card__update-badge" title="Update available" aria-label="Update available">
            ↑
          </span>
        )}
        <div className="library-card__scrim" aria-hidden />
        <div className="library-card__overlay">
          <div className="library-card__main">
            <h3 className="library-card__title">{game.name}</h3>
            <div className="library-card__stats">
              {game.has_depot_gids && game.update_status === 'update_available' && (
                <span className="library-card__update-chip">↑ Update</span>
              )}
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
        {showPlay && (
          <button
            type="button"
            className="library-card__play"
            disabled={launching || deleting}
            aria-label={hasExe ? `Play ${game.name}` : `Set up Play for ${game.name}`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onPlay()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {playLabel}
          </button>
        )}
      </div>
    </article>
  )
}

function GameListRow({
  game,
  menuOpen,
  menuMode,
  menuPosition,
  deleting,
  refreshing,
  showPlay,
  launching,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onPlay,
  onOpenFolder,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  menuOpen: boolean
  menuMode: GameCardMenuMode
  menuPosition: MenuPosition | null
  deleting: boolean
  refreshing: boolean
  showPlay: boolean
  launching: boolean
  onOpenMenu: (position: MenuPosition) => void
  onCloseMenu: () => void
  onOpen: () => void
  onPlay: () => void
  onOpenFolder: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const completionPct = Math.round(game.completion_pct)
  const hasPlatinum = game.has_platinum
  const hasExe = Boolean(game.launch_exe?.trim())
  const playLabel = launching ? 'Starting…' : hasExe ? 'Play' : 'Set up'
  const showFolder = shouldShowOpenFolder(game.install_path ?? '', game.launch_exe ?? '')

  const { ...longPressHandlers } = useLongPress({
    onLongPress: (position: PointerPosition) => onOpenMenu(position),
    onShortPress: onOpen,
    disabled: menuOpen
  })

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    onOpenMenu({ x: e.clientX, y: e.clientY })
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
      return
    }
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      onOpenMenu({ x: rect.left, y: rect.bottom })
    }
  }

  return (
    <li
      className={`library-list-row${hasPlatinum ? ' library-list-row--platinum' : ''}${
        menuOpen ? ' library-list-row--menu-open' : ''
      }${deleting ? ' library-list-row--deleting' : ''}`}
      {...longPressHandlers}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${game.name}, ${game.unlocked_achievements} of ${game.total_achievements} achievements, ${formatPlaytimeCompact(game.playtime_seconds ?? 0)} playtime, ${completionPct} percent complete`}
    >
      {menuOpen && menuPosition && (
        <GameCardMenu
          gameName={game.name}
          mode={menuMode}
          deleting={deleting}
          refreshing={refreshing}
          launching={launching}
          showPlay={showPlay}
          hasExe={hasExe}
          showOpenFolder={showFolder}
          position={menuPosition}
          classPrefix="library-list-row"
          onPlay={onPlay}
          onOpen={onOpen}
          onOpenFolder={onOpenFolder}
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
        {game.has_depot_gids && game.update_status === 'update_available' && (
          <span className="library-list-row__update-badge" title="Update available" aria-label="Update available">
            ↑
          </span>
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

      {showPlay && (
        <button
          type="button"
          className="library-list-row__play"
          disabled={launching || deleting}
          aria-label={hasExe ? `Play ${game.name}` : `Set up Play for ${game.name}`}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onPlay()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          {playLabel}
        </button>
      )}

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
