import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WantedGame } from '../../../shared/types'
import type { MenuPosition } from './GameCardMenu'
import { useLongPress, type PointerPosition } from '../hooks/useLongPress'

interface Props {
  games: WantedGame[]
  loading?: boolean
  onAddWanted: () => void
  onAddToLibrary: (game: WantedGame) => void
  onRemove: (appid: string) => void
  onOpenStore: (appid: string) => void
}

/**
 * Compact Wanted tray for Library chrome center (search) slot.
 * Horizontal scroll of short list-style chips (no Play / progress).
 */
export default function WantedRail({
  games,
  loading = false,
  onAddWanted,
  onAddToLibrary,
  onRemove,
  onOpenStore
}: Props): React.ReactElement {
  const [menuAppid, setMenuAppid] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  function closeMenu(): void {
    setMenuAppid(null)
    setMenuPosition(null)
  }

  function openMenu(appid: string, position: MenuPosition): void {
    setMenuAppid(appid)
    setMenuPosition(position)
  }

  useEffect(() => {
    if (!menuAppid) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeMenu()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuAppid])

  return (
    <div className="wanted-rail" aria-label="Wanted games">
      <div className="wanted-rail__inner">
        <button
          type="button"
          className="library-view-toggle wanted-rail__add"
          aria-label="Add a game to Wanted"
          title="Add to Wanted"
          onClick={onAddWanted}
        >
          +
        </button>
        <div className="wanted-rail__scroller" role="list">
          {loading ? (
            <span className="wanted-rail__hint" role="status">
              Loading…
            </span>
          ) : games.length === 0 ? (
            <span className="wanted-rail__hint">Wanted</span>
          ) : (
            games.map((game) => (
              <WantedChip
                key={game.appid}
                game={game}
                menuOpen={menuAppid === game.appid}
                menuPosition={menuAppid === game.appid ? menuPosition : null}
                onOpenMenu={(position) => openMenu(game.appid, position)}
                onCloseMenu={closeMenu}
                onOpen={() => {
                  closeMenu()
                  onOpenStore(game.appid)
                }}
                onAddToLibrary={() => {
                  closeMenu()
                  onAddToLibrary(game)
                }}
                onRemove={() => {
                  closeMenu()
                  onRemove(game.appid)
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function WantedChip({
  game,
  menuOpen,
  menuPosition,
  onOpenMenu,
  onCloseMenu,
  onOpen,
  onAddToLibrary,
  onRemove
}: {
  game: WantedGame
  menuOpen: boolean
  menuPosition: MenuPosition | null
  onOpenMenu: (position: MenuPosition) => void
  onCloseMenu: () => void
  onOpen: () => void
  onAddToLibrary: () => void
  onRemove: () => void
}): React.ReactElement {
  const { ...longPressHandlers } = useLongPress({
    onLongPress: (position: PointerPosition) => onOpenMenu(position),
    onShortPress: onOpen,
    disabled: menuOpen
  })

  return (
    <article
      className={`wanted-chip${menuOpen ? ' wanted-chip--menu-open' : ''}`}
      role="listitem"
      tabIndex={0}
      title={game.name}
      aria-label={`${game.name}, Wanted — open on Steam Store`}
      {...longPressHandlers}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onOpenMenu({ x: e.clientX, y: e.clientY })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      {menuOpen && menuPosition
        ? createPortal(
            <div
              className="library-card__menu library-game-menu wanted-chip__menu"
              style={{ left: menuPosition.x, top: menuPosition.y }}
              data-library-game-menu="true"
              role="menu"
              aria-label="Wanted actions"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="library-card__menu-dismiss"
                onClick={onCloseMenu}
                aria-label="Close menu"
              >
                ×
              </button>
              <div className="library-card__menu-actions" role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="library-menu-chip library-menu-chip--primary"
                  onClick={onAddToLibrary}
                >
                  Add to Library
                </button>
                <button type="button" role="menuitem" className="library-menu-chip" onClick={onOpen}>
                  Open on Steam
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="library-menu-chip library-menu-chip--danger"
                  onClick={onRemove}
                >
                  Remove from Wanted
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
      <div className="wanted-chip__face">
        <div className="wanted-chip__thumb-wrap">
          {game.coverUrl ? (
            <img className="wanted-chip__thumb" src={game.coverUrl} alt="" loading="lazy" />
          ) : (
            <div className="wanted-chip__thumb wanted-chip__thumb--placeholder" aria-hidden />
          )}
        </div>
        <h3 className="wanted-chip__name">{game.name}</h3>
        <button
          type="button"
          className="wanted-chip__add"
          aria-label={`Add ${game.name} to Library`}
          title="Add to Library"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onAddToLibrary()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          +
        </button>
      </div>
    </article>
  )
}
