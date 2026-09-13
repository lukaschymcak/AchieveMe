import React, { useRef, useState } from 'react'
import type { SteamSearchResult, WantedAddResult } from '../../../shared/types'
import { Chip, AppSearchInput } from './app'

interface Props {
  onClose: () => void
  onAdded: () => void
}

/**
 * Steam-search modal that pins an unowned title to Wanted (no Goldberg setup).
 */
export default function AddWantedModal({ onClose, onAdded }: Props): React.ReactElement {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SteamSearchResult[]>([])
  const [selected, setSelected] = useState<SteamSearchResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = (value: string): void => {
    setQuery(value)
    setErrorMsg('')
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    searchRef.current = setTimeout(() => {
      void runSearch(value)
    }, 400)
  }

  const runSearch = async (q: string): Promise<void> => {
    setSearching(true)
    try {
      const res = await window.api.searchSteamGames(q)
      setResults(res)
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (): Promise<void> => {
    if (!selected || submitting) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const result: WantedAddResult = await window.api.addWantedGame({
        appid: selected.appid,
        name: selected.name,
        coverUrl: selected.imageUrl ?? undefined
      })
      if (!result.ok) {
        setErrorMsg(
          result.reason === 'in-library'
            ? 'That AppID is already in your library.'
            : 'Enter a valid Steam AppID.'
        )
        return
      }
      onAdded()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

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
          minHeight: 360,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px oklch(4% 0.01 275 / 0.8)'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-wanted-title"
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
            id="add-wanted-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
          >
            Add to Wanted
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            padding: '16px 20px',
            gap: 12,
            minHeight: 0
          }}
        >
          <p style={{ fontSize: 12, color: 'oklch(60% 0.01 275)', margin: 0, lineHeight: 1.5 }}>
            Search Steam for a title you do not own yet. Pin it here until you add it to the library.
          </p>
          <div style={{ position: 'relative' }}>
            <AppSearchInput
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by game name, Steam URL, or AppID…"
              autoFocus
              autoComplete="off"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            {searching && (
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  color: 'oklch(55% 0.01 275)'
                }}
              >
                Searching…
              </span>
            )}
          </div>

          {results.length > 0 && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 0
              }}
            >
              {results.map((r) => (
                <button
                  key={r.appid}
                  type="button"
                  onClick={() => {
                    setSelected(r)
                    setErrorMsg('')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background:
                      selected?.appid === r.appid ? 'oklch(20% 0.02 275)' : 'oklch(14% 0.014 275)',
                    border: `1px solid ${
                      selected?.appid === r.appid
                        ? 'oklch(38% 0.06 275)'
                        : 'oklch(20% 0.016 275)'
                    }`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt=""
                      width={46}
                      height={22}
                      style={{ objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 46,
                        height: 22,
                        borderRadius: 3,
                        background: 'oklch(22% 0.016 275)',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13,
                        color: 'oklch(92% 0.01 275)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {r.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'oklch(55% 0.01 275)' }}>
                      AppID {r.appid}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {errorMsg ? (
            <p style={{ margin: 0, fontSize: 12, color: 'oklch(70% 0.12 25)' }} role="alert">
              {errorMsg}
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid oklch(18% 0.016 275)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <Chip onClick={onClose}>Cancel</Chip>
          <Chip active onClick={() => void handleAdd()} disabled={!selected || submitting}>
            {submitting ? 'Adding…' : 'Add to Wanted'}
          </Chip>
        </div>
      </div>
    </div>
  )
}
