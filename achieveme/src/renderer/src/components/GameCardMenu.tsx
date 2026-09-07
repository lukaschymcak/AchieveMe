import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DELETE_CONFIRM, TOOLTIPS } from '../lib/helpContent'
import { playMenuLabel } from '../../../shared/libraryContextMenuUtils'

export type GameCardMenuMode = 'actions' | 'confirm-delete'

export type MenuPosition = { x: number; y: number }

interface Props {
  gameName: string
  mode: GameCardMenuMode
  deleting?: boolean
  refreshing?: boolean
  launching?: boolean
  showPlay?: boolean
  hasExe?: boolean
  showOpenFolder?: boolean
  position: MenuPosition
  classPrefix: 'library-card' | 'library-list-row'
  onPlay?: () => void
  onOpen: () => void
  onOpenFolder?: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onClose: () => void
}

/**
 * Pointer-anchored library game context menu (Play / Open / Open folder / Refresh / Delete).
 */
export default function GameCardMenu({
  gameName,
  mode,
  deleting = false,
  refreshing = false,
  launching = false,
  showPlay = false,
  hasExe = false,
  showOpenFolder = false,
  position,
  classPrefix,
  onPlay,
  onOpen,
  onOpenFolder,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onClose
}: Props): React.ReactElement {
  const base = `${classPrefix}__menu`
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState(position)

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) {
      setCoords(position)
      return
    }
    const pad = 8
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - pad
    const maxY = window.innerHeight - rect.height - pad
    setCoords({
      x: Math.max(pad, Math.min(position.x, maxX)),
      y: Math.max(pad, Math.min(position.y, maxY))
    })
  }, [position, mode, showPlay, showOpenFolder])

  useEffect(() => {
    function handlePointerDown(e: PointerEvent): void {
      const target = e.target as Node | null
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        onClose()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose])

  const playLabel = playMenuLabel(hasExe, launching)

  const menu = (
    <div
      ref={panelRef}
      className={`${base} library-game-menu`}
      style={{ left: coords.x, top: coords.y }}
      data-library-game-menu="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      role={mode === 'actions' ? 'menu' : 'dialog'}
      aria-label={mode === 'actions' ? 'Game actions' : 'Confirm delete game'}
    >
      <button
        type="button"
        className={`${base}-dismiss`}
        onClick={onClose}
        aria-label="Close menu"
      >
        ×
      </button>

      {mode === 'actions' ? (
        <div className={`${base}-actions`} role="none">
          {showPlay && (
            <button
              type="button"
              role="menuitem"
              className="library-menu-chip library-menu-chip--primary"
              onClick={onPlay}
              disabled={launching}
            >
              {playLabel}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={`library-menu-chip${showPlay ? '' : ' library-menu-chip--primary'}`}
            onClick={onOpen}
          >
            Open
          </button>
          {showOpenFolder && (
            <button
              type="button"
              role="menuitem"
              className="library-menu-chip"
              onClick={onOpenFolder}
            >
              Open folder
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="library-menu-chip"
            onClick={onRefresh}
            disabled={refreshing}
            title={TOOLTIPS.refreshGameMenu}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="library-menu-chip library-menu-chip--danger"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      ) : (
        <div className={`${base}-confirm`}>
          <p className={`${base}-confirm-title`}>Delete this game?</p>
          <p className={`${base}-confirm-name`}>{gameName}</p>
          <p className={`${base}-confirm-hint`}>{DELETE_CONFIRM}</p>
          <div className={`${base}-actions`} role="group" aria-label="Confirm delete">
            <button
              type="button"
              className="library-menu-chip library-menu-chip--danger-active"
              onClick={onConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="library-menu-chip"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}
