import React, { useEffect, useState } from 'react'
import type { GameSummary } from '../../../shared/types'
import SteamApiKeyForm from '../components/SteamApiKeyForm'

interface Props {
  onSelect: (appid: string) => void
  onGoToSettings?: () => void
}

export default function LibraryPage({ onSelect, onGoToSettings }: Props): React.ReactElement {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)

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

  function handleKeySaved(): void {
    setHasApiKey(true)
    setLoading(true)
    window.api
      .getAllGames()
      .then(setGames)
      .finally(() => setLoading(false))
  }

  if (hasApiKey === null) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!hasApiKey) {
    return (
      <div style={{ padding: 24 }}>
        <SteamApiKeyForm prominent onSaved={handleKeySaved} />
        {onGoToSettings && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
            Or configure it in{' '}
            <button
              onClick={onGoToSettings}
              style={{
                background: 'none',
                border: 'none',
                color: '#5865f2',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Settings
            </button>
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading library...</div>
  }

  if (games.length === 0) {
    return (
      <div style={{ padding: 24, color: '#888' }}>
        No games found. Make sure your emulator save folders exist, then click Refresh.
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Library ({games.length} games)</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16
        }}
      >
        {games.map((game) => (
          <GameCard key={game.appid} game={game} onClick={() => onSelect(game.appid)} />
        ))}
      </div>
    </div>
  )
}

function GameCard({
  game,
  onClick
}: {
  game: GameSummary
  onClick: () => void
}): React.ReactElement {
  const borderColor = game.has_platinum ? '#7b68ee' : '#2a2a35'

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: '#1a1a22',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt={game.name}
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            display: 'block',
            background: '#2a2a35'
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#2a2a35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontSize: 12,
            padding: 8,
            textAlign: 'center'
          }}
        >
          {game.name}
        </div>
      )}
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {game.name}
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {game.unlocked_achievements}/{game.total_achievements}
        </div>
        <div
          style={{
            marginTop: 6,
            height: 4,
            background: '#2a2a35',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${game.completion_pct}%`,
              background: game.has_platinum ? '#7b68ee' : '#5865f2',
              borderRadius: 2
            }}
          />
        </div>
      </div>
    </div>
  )
}
