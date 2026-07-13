import React from 'react'

export type GameCardMenuMode = 'actions' | 'confirm-delete'

interface Props {
  gameName: string
  mode: GameCardMenuMode
  deleting?: boolean
  refreshing?: boolean
  classPrefix: 'library-card' | 'library-list-row'
  onOpen: () => void
  onRefresh: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onClose: () => void
}

export default function GameCardMenu({
  gameName,
  mode,
  deleting = false,
  refreshing = false,
  classPrefix,
  onOpen,
  onRefresh,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onClose
}: Props): React.ReactElement {
  const base = `${classPrefix}__menu`

  return (
    <div
      className={base}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
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
        <div className={`${base}-actions`} role="toolbar" aria-label="Game actions">
          <button type="button" className="library-menu-chip library-menu-chip--primary" onClick={onOpen}>
            Open
          </button>
          <button
            type="button"
            className="library-menu-chip"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="library-menu-chip library-menu-chip--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      ) : (
        <div className={`${base}-confirm`}>
          <p className={`${base}-confirm-title`}>Delete this game?</p>
          <p className={`${base}-confirm-name`}>{gameName}</p>
          <p className={`${base}-confirm-hint`}>Removes the game and its save folder from disk.</p>
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
}
