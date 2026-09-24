import React from 'react'

interface PickerGame {
  appid: string
  name: string
}

interface Props {
  game: PickerGame
  onInstalled: () => void
  onDepot: () => void
  onClose: () => void
}

/**
 * Two-choice picker shown when adding a Wanted game to the library:
 * the game is already installed locally, or it should be fetched via Depot Downloader.
 */
export default function AddToLibraryPickerModal({
  game,
  onInstalled,
  onDepot,
  onClose
}: Props): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'oklch(6% 0.01 275 / 0.75)',
        backdropFilter: 'blur(6px)'
      }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'oklch(11% 0.014 275)',
          border: '1px solid oklch(22% 0.018 275)',
          borderRadius: 12,
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px oklch(4% 0.01 275 / 0.8)'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-library-picker-title"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid oklch(18% 0.016 275)'
          }}
        >
          <h2
            id="add-to-library-picker-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
          >
            Add “{game.name}” to Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'oklch(55% 0.01 275)',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, padding: '20px' }}>
          <ChoiceBox
            title="Already Installed"
            description="Point to an existing game folder on disk."
            onClick={onInstalled}
          />
          <ChoiceBox
            title="Depot Downloader"
            description="Download the game files via Steam depots."
            onClick={onDepot}
          />
        </div>
      </div>
    </div>
  )
}

function ChoiceBox({
  title,
  description,
  onClick
}: {
  title: string
  description: string
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '24px 16px',
        background: 'oklch(14% 0.014 275)',
        border: '1px solid oklch(22% 0.018 275)',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'center',
        color: 'oklch(92% 0.01 275)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'oklch(38% 0.06 275)'
        e.currentTarget.style.background = 'oklch(18% 0.016 275)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'oklch(22% 0.018 275)'
        e.currentTarget.style.background = 'oklch(14% 0.014 275)'
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: 'oklch(60% 0.01 275)', lineHeight: 1.4 }}>
        {description}
      </span>
    </button>
  )
}
