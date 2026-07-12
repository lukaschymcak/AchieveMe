import React, { useEffect, useMemo, useState } from 'react'
import type { GameSummary } from '../../../shared/types'
import SteamApiKeyForm from '../components/SteamApiKeyForm'
import { filterAndSortGames, type SortOption } from '../lib/libraryUtils'

interface Props {
  onSelect: (appid: string) => void
  onGoToSettings?: () => void
}

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: 'completion-asc', label: 'Least complete' },
  { id: 'unlocked-desc', label: 'Most unlocked' },
  { id: 'recent', label: 'Recently unlocked' }
]

export default function LibraryPage({ onSelect, onGoToSettings }: Props): React.ReactElement {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('unlocked-desc')
  const [deleteMode, setDeleteMode] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<GameSummary | null>(null)
  const [deletingAppid, setDeletingAppid] = useState<string | null>(null)

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
      <h2 style={{ marginBottom: 16 }}>Library ({displayedGames.length} games)</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search games..."
          style={{
            flex: '1 1 200px',
            minWidth: 180,
            padding: '8px 12px',
            background: '#1a1a22',
            border: '1px solid #3a3a48',
            borderRadius: 6,
            color: '#e8e8e8',
            fontSize: 13
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setSort(option.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: sort === option.id ? '#5865f2' : '#1a1a22',
                border: `1px solid ${sort === option.id ? '#5865f2' : '#3a3a48'}`,
                borderRadius: 6,
                color: sort === option.id ? '#fff' : '#e8e8e8'
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (deleteMode) {
                exitDeleteMode()
              } else {
                setDeleteMode(true)
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: deleteMode ? 'rgba(248, 113, 113, 0.15)' : '#1a1a22',
              border: `1px solid ${deleteMode ? '#f87171' : '#3a3a48'}`,
              borderRadius: 6,
              color: deleteMode ? '#f87171' : '#e8e8e8'
            }}
          >
            {deleteMode ? 'Cancel delete' : 'Delete'}
          </button>
        </div>
      </div>

      {displayedGames.length === 0 ? (
        <div style={{ color: '#888' }}>No games match your search.</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
            cursor: deleteMode ? 'crosshair' : 'default'
          }}
        >
          {displayedGames.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              deleteMode={deleteMode}
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
  deleteMode,
  isPending,
  deleting,
  onCardClick,
  onConfirmDelete,
  onCancelDelete
}: {
  game: GameSummary
  deleteMode: boolean
  isPending: boolean
  deleting: boolean
  onCardClick: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.ReactElement {
  const borderColor = isPending ? '#f87171' : game.has_platinum ? '#7b68ee' : '#2a2a35'

  return (
    <div
      onClick={onCardClick}
      style={{
        position: 'relative',
        background: '#1a1a22',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: deleting ? 0.5 : 1,
        cursor: deleteMode ? 'pointer' : 'pointer'
      }}
    >
      {isPending && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'rgba(15, 15, 19, 0.92)',
            padding: 16,
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>Are you sure?</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{game.name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onConfirmDelete}
              disabled={deleting}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: '#f87171',
                border: 'none',
                borderRadius: 6,
                color: '#fff'
              }}
            >
              Delete
            </button>
            <button
              onClick={onCancelDelete}
              disabled={deleting}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: '#1a1a22',
                border: '1px solid #3a3a48',
                borderRadius: 6,
                color: '#e8e8e8'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
