import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  GetNewsOptions,
  LibraryNewsItem,
  NewsPayload,
  NewsRelease
} from '../../../shared/types'
import {
  NEWS_GENRE_FILTERS,
  filterReleasesByGenreTagIds,
  formatFetchedAtRelative,
  formatReleaseDaysFromToday,
  groupLibraryNewsByRecency,
  hasUsableNewsPayload,
  isReleaseShipped,
  sortNewsReleases
} from '../../../shared/newsUtils'
import { AppChrome, AppNav, AppShell, Chip } from '../components/app'
import HelpTip from '../components/HelpTip'
import type { AppPage } from '../lib/appNavigation'
import { EMPTY_STATES, TOOLTIPS } from '../lib/helpContent'

export type NewsLoadState = 'loading' | 'ready' | 'error'

export const NEWS_LOAD_ERROR =
  'Could not load Steam news. Check your network connection and try Refresh.'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
  onSelectGame?: (appid: string) => void
  /** Prefetched payload from App (survives News unmount). */
  payload: NewsPayload | null
  errorMessage: string | null
  loadState: NewsLoadState
  onNewsResult: (result: {
    payload: NewsPayload | null
    errorMessage: string | null
    loadState: NewsLoadState
  }) => void
}

type ReleaseTab = 'week' | 'month'

const SKELETON_RELEASE_COUNT = 5
const SKELETON_LIBRARY_COUNT = 4
const GENRE_FILTER_STORAGE_KEY = 'achieveme.newsGenreFilters'
const OLDER_PREVIEW = 3

const LIBRARY_GROUP_LABELS: Array<{ id: 'today' | 'thisWeek' | 'older'; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'older', label: 'Older' }
]

const TAB_LABELS: Array<{ id: ReleaseTab; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }
]

const VALID_GENRE_IDS = new Set<number>(NEWS_GENRE_FILTERS.map((g) => g.id))

function loadGenreFilters(): number[] {
  try {
    const raw = localStorage.getItem(GENRE_FILTER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && VALID_GENRE_IDS.has(id))
  } catch {
    return []
  }
}

function saveGenreFilters(ids: number[]): void {
  try {
    localStorage.setItem(GENRE_FILTER_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function storeUrl(appid: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(appid)}`
}

function formatNewsDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function releasesForTab(payload: NewsPayload, tab: ReleaseTab): NewsRelease[] {
  return tab === 'week' ? payload.thisWeek : payload.thisMonth
}

export default function NewsPage({
  page,
  onNavigate,
  onSelectGame,
  payload,
  errorMessage,
  loadState,
  onNewsResult
}: Props): React.ReactElement {
  const [tab, setTab] = useState<ReleaseTab>('week')
  const [refreshing, setRefreshing] = useState(false)
  const [genreFilters, setGenreFilters] = useState<number[]>(() => loadGenreFilters())
  const [olderExpanded, setOlderExpanded] = useState(false)
  const [wantedAppids, setWantedAppids] = useState<Set<string>>(() => new Set())
  const [pinningAppid, setPinningAppid] = useState<string | null>(null)

  useEffect(() => {
    void window.api.listWantedGames().then((games) => {
      setWantedAppids(new Set(games.map((g) => g.appid)))
    })
  }, [])

  const handlePinWanted = async (release: NewsRelease): Promise<void> => {
    if (pinningAppid || wantedAppids.has(release.appid)) return
    setPinningAppid(release.appid)
    try {
      const result = await window.api.addWantedGame({
        appid: release.appid,
        name: release.name,
        coverUrl: release.headerImage || undefined
      })
      if (result.ok) {
        setWantedAppids((prev) => new Set(prev).add(release.appid))
      }
    } finally {
      setPinningAppid(null)
    }
  }

  const fetchNews = useCallback(
    (options: GetNewsOptions = {}) => {
      const forceRefresh = Boolean(options.forceRefresh)
      setRefreshing(true)

      return window.api
        .getNews({ forceRefresh })
        .then((data) => {
          onNewsResult({
            payload: data,
            errorMessage: null,
            loadState: 'ready'
          })
        })
        .catch(() => {
          if (hasUsableNewsPayload(payload)) {
            onNewsResult({
              payload,
              errorMessage: null,
              loadState: 'ready'
            })
            return
          }
          onNewsResult({
            payload: null,
            errorMessage: NEWS_LOAD_ERROR,
            loadState: 'error'
          })
        })
        .finally(() => {
          setRefreshing(false)
        })
    },
    [onNewsResult, payload]
  )

  // Fallback only if App prefetch never populated (should be rare).
  useEffect(() => {
    if (hasUsableNewsPayload(payload)) return
    if (loadState === 'loading') return
    if (loadState === 'error') return
    void fetchNews({ forceRefresh: false })
  }, [payload, loadState, fetchNews])

  const weekCount = useMemo(
    () =>
      payload
        ? filterReleasesByGenreTagIds(payload.thisWeek, genreFilters).length
        : 0,
    [payload, genreFilters]
  )
  const monthCount = useMemo(
    () =>
      payload
        ? filterReleasesByGenreTagIds(payload.thisMonth, genreFilters).length
        : 0,
    [payload, genreFilters]
  )

  const list = useMemo(
    () =>
      payload
        ? sortNewsReleases(
            filterReleasesByGenreTagIds(releasesForTab(payload, tab), genreFilters)
          )
        : [],
    [payload, tab, genreFilters]
  )

  const libraryGroups = useMemo(
    () => groupLibraryNewsByRecency(payload?.libraryNews ?? []),
    [payload]
  )

  function handleGenreToggle(tagId: number): void {
    setGenreFilters((current) => {
      const next = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
      saveGenreFilters(next)
      return next
    })
  }

  function handleReleaseActivate(release: NewsRelease): void {
    if (release.inLibrary && onSelectGame) {
      onSelectGame(release.appid)
    }
  }

  return (
    <AppShell column>
      <AppChrome
        left={<AppNav page={page} onNavigate={onNavigate} />}
        right={
          <span className="app-chrome__refresh-wrap library-chrome__refresh-wrap">
            <Chip
              variant="action"
              disabled={refreshing || loadState === 'loading'}
              onClick={() => void fetchNews({ forceRefresh: true })}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Chip>
            <HelpTip content={TOOLTIPS.refreshNews} label="Refresh news help" />
          </span>
        }
      />

      {loadState === 'error' && (
        <div className="news-page news-page--state">
          <div className="news-page__error" role="alert">
            <p className="news-page__error-text">{errorMessage ?? NEWS_LOAD_ERROR}</p>
            <Chip variant="action" onClick={() => void fetchNews({ forceRefresh: true })}>
              Retry
            </Chip>
          </div>
        </div>
      )}

      {loadState === 'loading' && (
        <div className="news-page" aria-busy="true">
          <header className="news-page__header">
            <h1 className="news-page__title">News</h1>
            <p className="news-page__lead" role="status" aria-live="polite">
              Loading Steam news…
            </p>
          </header>
          <NewsSkeletonColumns />
        </div>
      )}

      {loadState === 'ready' && payload && (
        <div className="news-page">
          <header className="news-page__header">
            <h1 className="news-page__title">News</h1>
            <p className="news-page__lead">
              Popular Steam releases this week and this month, plus announcements for games in your
              library.
            </p>
            <p className="news-page__updated">
              Updated {formatFetchedAtRelative(payload.fetchedAt)}
              {refreshing ? ' · Updating…' : ''}
            </p>
          </header>

          <div className="news-page__columns">
            <section className="news-section news-section--releases" aria-labelledby="news-releases-heading">
              <div className="news-section__head">
                <h2 id="news-releases-heading" className="news-section__title">
                  Popular releases
                </h2>
                <div className="news-section__tabs" role="tablist" aria-label="Release window">
                  {TAB_LABELS.map((item) => {
                    const count = item.id === 'week' ? weekCount : monthCount
                    return (
                      <Chip
                        key={item.id}
                        variant="nav"
                        active={tab === item.id}
                        aria-current={tab === item.id ? 'page' : undefined}
                        onClick={() => setTab(item.id)}
                      >
                        {item.label} ({count})
                      </Chip>
                    )
                  })}
                </div>
              </div>

              <div
                className="news-genre-filters"
                role="group"
                aria-label="Filter popular releases by genre"
              >
                {NEWS_GENRE_FILTERS.map((genre) => {
                  const active = genreFilters.includes(genre.id)
                  return (
                    <Chip
                      key={genre.id}
                      variant="nav"
                      active={active}
                      aria-pressed={active}
                      onClick={() => handleGenreToggle(genre.id)}
                    >
                      {genre.label}
                    </Chip>
                  )
                })}
              </div>

              {list.length === 0 ? (
                <p className="news-page__empty">
                  {genreFilters.length > 0
                    ? EMPTY_STATES.noNewsReleasesFiltered
                    : EMPTY_STATES.noNewsReleases}
                </p>
              ) : (
                <ul className="news-release-list">
                  {list.map((release) => (
                    <li key={`${tab}-${release.appid}`} className="news-release-list__item">
                      {release.inLibrary ? (
                        <button
                          type="button"
                          className="news-release-row"
                          onClick={() => handleReleaseActivate(release)}
                          aria-label={`Open ${release.name} in library`}
                        >
                          <ReleaseRowContent release={release} />
                        </button>
                      ) : (
                        <div
                          className="news-release-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => window.open(storeUrl(release.appid), '_blank', 'noreferrer')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              window.open(storeUrl(release.appid), '_blank', 'noreferrer')
                            }
                          }}
                          aria-label={`Open ${release.name} on Steam Store`}
                        >
                          <ReleaseRowContent release={release} />
                          <button
                            type="button"
                            className={`news-release-row__wanted-btn${
                              wantedAppids.has(release.appid) ? ' news-release-row__wanted-btn--active' : ''
                            }`}
                            disabled={
                              pinningAppid === release.appid || wantedAppids.has(release.appid)
                            }
                            aria-label={
                              wantedAppids.has(release.appid)
                                ? `${release.name} is on Wanted`
                                : `Add ${release.name} to Wanted`
                            }
                            title={
                              wantedAppids.has(release.appid)
                                ? 'On Wanted'
                                : 'Add to Wanted'
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              void handlePinWanted(release)
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {wantedAppids.has(release.appid)
                              ? '✓'
                              : pinningAppid === release.appid
                                ? '…'
                                : '+'}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="news-section news-section--library" aria-labelledby="news-library-heading">
              <div className="news-section__head">
                <h2 id="news-library-heading" className="news-section__title">
                  Library news
                </h2>
              </div>
              {payload.libraryNews.length === 0 ? (
                <p className="news-page__empty">{EMPTY_STATES.noLibraryNews}</p>
              ) : (
                <div className="news-library-groups">
                  {LIBRARY_GROUP_LABELS.map((group) => {
                    const items = libraryGroups[group.id]
                    if (items.length === 0) return null

                    const visible =
                      group.id === 'older' && !olderExpanded
                        ? items.slice(0, OLDER_PREVIEW)
                        : items
                    const hiddenCount =
                      group.id === 'older' ? Math.max(0, items.length - OLDER_PREVIEW) : 0

                    return (
                      <div
                        key={group.id}
                        className="news-library-group"
                        aria-labelledby={`news-library-${group.id}`}
                      >
                        <h3
                          id={`news-library-${group.id}`}
                          className="news-library-group__title"
                        >
                          {group.label}
                        </h3>
                        <ul className="news-library-list">
                          {visible.map((item) => (
                            <li
                              key={`${item.appid}-${item.url}-${item.date}`}
                              className="news-library-list__item"
                            >
                              <LibraryNewsRow
                                item={item}
                                onOpenGame={
                                  onSelectGame
                                    ? () => onSelectGame(item.appid)
                                    : undefined
                                }
                              />
                            </li>
                          ))}
                        </ul>
                        {group.id === 'older' && hiddenCount > 0 ? (
                          <div className="news-library-group__expand">
                            <Chip
                              variant="action"
                              onClick={() => setOlderExpanded((open) => !open)}
                            >
                              {olderExpanded
                                ? 'Show less'
                                : `Show older (${hiddenCount})`}
                            </Chip>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function NewsSkeletonColumns(): React.ReactElement {
  return (
    <div className="news-page__columns" aria-hidden="true">
      <section className="news-section news-section--releases">
        <div className="news-section__head">
          <div className="news-skeleton news-skeleton--title" />
          <div className="news-section__tabs">
            <div className="news-skeleton news-skeleton--chip" />
            <div className="news-skeleton news-skeleton--chip" />
          </div>
        </div>
        <ul className="news-release-list">
          {Array.from({ length: SKELETON_RELEASE_COUNT }, (_, i) => (
            <li key={`release-skel-${i}`} className="news-release-list__item">
              <div className="news-release-row news-release-row--skeleton">
                <span className="news-release-row__media">
                  <span className="news-release-row__placeholder" />
                </span>
                <span className="news-release-row__body">
                  <span className="news-skeleton news-skeleton--name" />
                  <span className="news-skeleton news-skeleton--meta" />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="news-section news-section--library">
        <div className="news-section__head">
          <div className="news-skeleton news-skeleton--title" />
        </div>
        <ul className="news-library-list">
          {Array.from({ length: SKELETON_LIBRARY_COUNT }, (_, i) => (
            <li key={`library-skel-${i}`} className="news-library-list__item">
              <div className="news-library-row news-library-row--skeleton">
                <span className="news-skeleton news-skeleton--meta" />
                <span className="news-skeleton news-skeleton--name" />
                <span className="news-skeleton news-skeleton--excerpt" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ReleaseRowContent({ release }: { release: NewsRelease }): React.ReactElement {
  const daysLabel = formatReleaseDaysFromToday(release.releaseUnix)
  const shipped = isReleaseShipped(release.releaseUnix)

  return (
    <>
      <span className="news-release-row__media" aria-hidden="true">
        {release.headerImage ? (
          <img src={release.headerImage} alt="" className="news-release-row__img" loading="lazy" />
        ) : (
          <span className="news-release-row__placeholder" />
        )}
      </span>
      <span className="news-release-row__body">
        <span className="news-release-row__name">{release.name}</span>
        <span className="news-release-row__meta">
          <span className="news-release-row__date">
            {release.releaseLabel || 'Coming soon'}
            {daysLabel ? (
              <span className="news-release-row__days"> · {daysLabel}</span>
            ) : null}
          </span>
          {shipped && (
            <span className="news-release-row__badge news-release-row__badge--released">Released</span>
          )}
          {release.inLibrary && <span className="news-release-row__badge">In library</span>}
        </span>
      </span>
    </>
  )
}

function LibraryNewsRow({
  item,
  onOpenGame
}: {
  item: LibraryNewsItem
  onOpenGame?: () => void
}): React.ReactElement {
  return (
    <article className="news-library-row">
      <div className="news-library-row__top">
        <div className="news-library-row__actions">
          {onOpenGame ? (
            <button type="button" className="news-library-row__game" onClick={onOpenGame}>
              {item.gameName}
            </button>
          ) : (
            <span className="news-library-row__game">{item.gameName}</span>
          )}
          <a
            className="news-library-row__steam"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            Open on Steam
          </a>
        </div>
        <time className="news-library-row__date" dateTime={new Date(item.date * 1000).toISOString()}>
          {formatNewsDate(item.date)}
        </time>
      </div>
      <p className="news-library-row__title">{item.title}</p>
      {item.contents ? <p className="news-library-row__excerpt">{item.contents}</p> : null}
    </article>
  )
}
