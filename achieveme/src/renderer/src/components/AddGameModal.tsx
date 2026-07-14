import React, { useEffect, useRef, useState } from 'react'
import type { SteamApiDllInfo, SteamSearchResult } from '../../../shared/types'
import { Chip, AppSearchInput } from './app'
import { ADD_GAME } from '../lib/helpContent'

type Step = 'search' | 'dll' | 'apply'
type ApplyState = 'idle' | 'running' | 'done' | 'error'

interface Props {
  onClose: () => void
  onGameAdded: () => void
}

const STEP_TITLES: Record<Step, string> = {
  search: 'Add Game — Find Game',
  dll: 'Add Game — Game Location',
  apply: 'Add Game — Apply'
}

export default function AddGameModal({ onClose, onGameAdded }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SteamSearchResult[]>([])
  const [selected, setSelected] = useState<SteamSearchResult | null>(null)
  const [dllInfo, setDllInfo] = useState<SteamApiDllInfo | null>(null)
  const [applyState, setApplyState] = useState<ApplyState>('idle')
  const [logLines, setLogLines] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logLines])

  useEffect(() => {
    return () => {
      window.api.offGoldbergLog()
    }
  }, [])

  function handleQueryChange(value: string): void {
    setQuery(value)
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    searchRef.current = setTimeout(() => {
      runSearch(value)
    }, 400)
  }

  async function runSearch(q: string): Promise<void> {
    setSearching(true)
    try {
      const res = await window.api.searchSteamGames(q)
      setResults(res)
    } finally {
      setSearching(false)
    }
  }

  async function handleBrowseDll(): Promise<void> {
    if (typeof window.api.browseDllPath !== 'function') {
      setErrorMsg(
        'Browse API is not loaded. Fully quit AchieveMe (close the window) and run npm run dev again.'
      )
      return
    }
    try {
      setErrorMsg('')
      const info = await window.api.browseDllPath()
      if (info) setDllInfo(info)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  function goToDllStep(): void {
    if (!selected) return
    setStep('dll')
    setDllInfo(null)
    setErrorMsg('')
  }

  function goToApplyStep(): void {
    if (!dllInfo) return
    setStep('apply')
    setLogLines([])
    setApplyState('idle')
    setErrorMsg('')
  }

  async function handleApply(): Promise<void> {
    if (!selected || !dllInfo) return
    setApplyState('running')
    setLogLines([])

    window.api.onGoldbergLog((line) => {
      setLogLines((prev) => [...prev, line])
    })

    try {
      await window.api.applyGoldberg({
        appid: selected.appid,
        dllPath: dllInfo.path
      })
      setApplyState('done')
    } catch (err) {
      setApplyState('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      window.api.offGoldbergLog()
    }
  }

  function handleDone(): void {
    onGameAdded()
    onClose()
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
        aria-label="Add game to library"
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {STEP_TITLES[step]}
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

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {step === 'search' && (
            <SearchStep
              query={query}
              onQueryChange={handleQueryChange}
              searching={searching}
              results={results}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {step === 'dll' && selected && (
            <DllStep
              game={selected}
              dllInfo={dllInfo}
              onBrowse={handleBrowseDll}
              errorMsg={errorMsg}
            />
          )}
          {step === 'apply' && selected && dllInfo && (
            <ApplyStep
              game={selected}
              dllInfo={dllInfo}
              applyState={applyState}
              logLines={logLines}
              logRef={logRef}
              errorMsg={errorMsg}
            />
          )}
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
          {step === 'search' && (
            <>
              <Chip onClick={onClose}>Cancel</Chip>
              <Chip active onClick={goToDllStep} disabled={!selected}>
                Next
              </Chip>
            </>
          )}
          {step === 'dll' && (
            <>
              <Chip onClick={() => setStep('search')}>Back</Chip>
              <Chip active onClick={goToApplyStep} disabled={!dllInfo}>
                Next
              </Chip>
            </>
          )}
          {step === 'apply' && applyState === 'idle' && (
            <>
              <Chip onClick={() => setStep('dll')}>Back</Chip>
              <Chip active onClick={handleApply}>
                Add to Library
              </Chip>
            </>
          )}
          {step === 'apply' && applyState === 'running' && (
            <Chip disabled>Adding…</Chip>
          )}
          {step === 'apply' && applyState === 'done' && (
            <Chip active onClick={handleDone}>
              Done
            </Chip>
          )}
          {step === 'apply' && applyState === 'error' && (
            <>
              <Chip onClick={() => setStep('dll')}>Back</Chip>
              <Chip active onClick={handleApply}>
                Retry
              </Chip>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchStep({
  query,
  onQueryChange,
  searching,
  results,
  selected,
  onSelect
}: {
  query: string
  onQueryChange: (v: string) => void
  searching: boolean
  results: SteamSearchResult[]
  selected: SteamSearchResult | null
  onSelect: (r: SteamSearchResult) => void
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '16px 20px', gap: 12, minHeight: 0 }}>
      <p style={{ fontSize: 12, color: 'oklch(60% 0.01 275)', margin: 0, lineHeight: 1.5 }}>
        {ADD_GAME.searchHelp}
      </p>
      <div style={{ position: 'relative' }}>
        <AppSearchInput
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
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
              onClick={() => onSelect(r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background:
                  selected?.appid === r.appid
                    ? 'oklch(20% 0.02 275)'
                    : 'oklch(14% 0.014 275)',
                border: `1px solid ${selected?.appid === r.appid ? 'oklch(38% 0.06 275)' : 'oklch(20% 0.016 275)'}`,
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
                  style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 30,
                    background: 'oklch(18% 0.012 275)',
                    borderRadius: 3,
                    flexShrink: 0
                  }}
                />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {r.name}
                </div>
                <div style={{ fontSize: 11, color: 'oklch(52% 0.01 275)' }}>AppID {r.appid}</div>
              </div>
              {selected?.appid === r.appid && (
                <span style={{ color: 'var(--color-action)', fontSize: 14, flexShrink: 0 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {!searching && query.trim() && results.length === 0 && (
        <p style={{ fontSize: 13, color: 'oklch(52% 0.01 275)', margin: 0 }}>
          No results found.
        </p>
      )}

      {selected && (
        <div
          style={{
            fontSize: 12,
            color: 'oklch(60% 0.01 275)',
            borderTop: '1px solid oklch(18% 0.016 275)',
            paddingTop: 10,
            marginTop: 4
          }}
        >
          Selected: <strong style={{ color: 'var(--ink)' }}>{selected.name}</strong>{' '}
          <span style={{ color: 'oklch(44% 0.01 275)' }}>(AppID {selected.appid})</span>
        </div>
      )}
    </div>
  )
}

function DllStep({
  game,
  dllInfo,
  onBrowse,
  errorMsg
}: {
  game: SteamSearchResult
  dllInfo: SteamApiDllInfo | null
  onBrowse: () => void
  errorMsg: string
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'oklch(14% 0.014 275)',
          border: '1px solid oklch(20% 0.016 275)',
          borderRadius: 8
        }}
      >
        {game.imageUrl ? (
          <img
            src={game.imageUrl}
            alt=""
            style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 48, height: 36, background: 'oklch(18% 0.012 275)', borderRadius: 3, flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{game.name}</div>
          <div style={{ fontSize: 11, color: 'oklch(52% 0.01 275)' }}>AppID {game.appid}</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'oklch(60% 0.01 275)', margin: 0, lineHeight: 1.5 }}>
        {ADD_GAME.dllHelp}
      </p>

      <Chip variant="action" onClick={onBrowse}>
        Browse for Steam API DLL…
      </Chip>

      {dllInfo && (
        <div
          style={{
            padding: '10px 12px',
            background: 'oklch(14% 0.014 275)',
            border: '1px solid oklch(28% 0.04 230)',
            borderRadius: 8,
            fontSize: 12
          }}
        >
          <div style={{ color: 'var(--ink)', fontWeight: 500, marginBottom: 4 }}>
            {dllInfo.fileName}{' '}
            <span style={{ color: 'oklch(52% 0.01 275)' }}>({dllInfo.architecture})</span>
          </div>
          <div
            style={{
              color: 'oklch(55% 0.01 275)',
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11
            }}
          >
            {dllInfo.path}
          </div>
        </div>
      )}

      {errorMsg && (
        <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{errorMsg}</p>
      )}
    </div>
  )
}

function ApplyStep({
  game,
  dllInfo,
  applyState,
  logLines,
  logRef,
  errorMsg
}: {
  game: SteamSearchResult
  dllInfo: SteamApiDllInfo
  applyState: ApplyState
  logLines: string[]
  logRef: React.RefObject<HTMLDivElement>
  errorMsg: string
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '16px 20px', gap: 12, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'oklch(14% 0.014 275)',
          border: '1px solid oklch(20% 0.016 275)',
          borderRadius: 8
        }}
      >
        {game.imageUrl ? (
          <img
            src={game.imageUrl}
            alt=""
            style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 48, height: 36, background: 'oklch(18% 0.012 275)', borderRadius: 3, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{game.name}</div>
          <div style={{ fontSize: 11, color: 'oklch(52% 0.01 275)' }}>
            AppID {game.appid} · {dllInfo.fileName} ({dllInfo.architecture})
          </div>
        </div>
        {applyState === 'done' && (
          <span style={{ color: '#4ade80', fontSize: 20, flexShrink: 0 }}>✓</span>
        )}
        {applyState === 'error' && (
          <span style={{ color: '#f87171', fontSize: 20, flexShrink: 0 }}>✗</span>
        )}
      </div>

      {applyState === 'idle' && (
        <p style={{ fontSize: 13, color: 'oklch(60% 0.01 275)', margin: 0, lineHeight: 1.5 }}>
          {ADD_GAME.applyHelp}
        </p>
      )}

      {(applyState === 'running' || applyState === 'done' || applyState === 'error') && (
        <div
          ref={logRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 120,
            background: 'oklch(8% 0.01 275)',
            border: '1px solid oklch(16% 0.014 275)',
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            color: 'oklch(70% 0.01 275)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {logLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {applyState === 'running' && (
            <div style={{ color: 'oklch(55% 0.01 275)' }}>▌</div>
          )}
        </div>
      )}

      {applyState === 'done' && (
        <p style={{ fontSize: 13, color: '#4ade80', margin: 0 }}>
          Game added successfully! Click Done to refresh the library.
        </p>
      )}

      {applyState === 'error' && (
        <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
          Error: {errorMsg}
        </p>
      )}
    </div>
  )
}
