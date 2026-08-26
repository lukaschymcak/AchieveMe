import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  GetNewsOptions,
  LibraryNewsItem,
  NewsPayload,
  NewsRelease
} from '../../../shared/types'
import { formatReleaseDaysFromToday } from '../../../shared/newsUtils'
import { AppChrome, AppNav, AppShell, Chip } from '../components/app'
import HelpTip from '../components/HelpTip'
import type { AppPage } from '../lib/appNavigation'
import { EMPTY_STATES, TOOLTIPS } from '../lib/helpContent'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
  onSelectGame?: (appid: string) => void
}

type LoadState = 'loading' | 'ready' | 'error'
type ReleaseTab = 'week' | 'month'

const LOAD_ERROR =
  'Could not load Steam news. Check your network connection and try Refresh.'

const TAB_LABELS: Array<{ id: ReleaseTab; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }
]

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
  onSelectGame
}: Props): React.ReactElement {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [payload, setPayload] = useState<NewsPayload | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tab, setTab] = useState<ReleaseTab>('week')
  const [refreshing, setRefreshing] = useState(false)

  const fetchNews = useCallback((options: GetNewsOptions = {}) => {
    const forceRefresh = Boolean(options.forceRefresh)
    setRefreshing(true)

    return window.api
      .getNews({ forceRefresh })
      .then((data) => {
        setPayload(data)
        setErrorMessage(null)
        setLoadState('ready')
      })
      .catch(() => {
        setPayload((current) => {
          if (current) {
            setLoadState('ready')
            return current
          }
          setErrorMessage(LOAD_ERROR)
          setLoadState('error')
          return current
        })
      })
      .finally(() => {
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    void window.api
      .getNews({ forceRefresh: false })
      .then((data) => {
        setPayload(data)
        setErrorMessage(null)
        setLoadState('ready')
      })
      .catch(() => {
        setErrorMessage(LOAD_ERROR)
        setLoadState('error')
      })
  }, [])

  const list = useMemo(() => (payload ? releasesForTab(payload, tab) : []), [payload, tab])

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

      {loadState === 'loading' && (
        <div className="news-page news-page--state" aria-busy="true">
          <p className="news-page__loading" role="status" aria-live="polite">
            Loading Steam news…
          </p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="news-page news-page--state">
          <div className="news-page__error" role="alert">
            <p className="news-page__error-text">{errorMessage ?? LOAD_ERROR}</p>
            <Chip variant="action" onClick={() => void fetchNews({ forceRefresh: true })}>
              Retry
            </Chip>
          </div>
        </div>
      )}

      {loadState === 'ready' && payload && (
        <div className="news-page">
          <header className="news-page__header">
            <h1 className="news-page__title">News</h1>
            <p className="news-page__lead">
              Popular Steam releases this week and this month (Steam popular-wishlist chart —
              exact wishlist counts are not public), plus announcements for games in your library.
              {payload.fromCache ? ' Showing cached results.' : ''}
              {refreshing ? ' Updating…' : ''}
            </p>
          </header>

          <div className="news-page__columns">
            <section className="news-section news-section--releases" aria-labelledby="news-releases-heading">
              <div className="news-section__head">
                <h2 id="news-releases-heading" className="news-section__title">
                  Popular releases
                </h2>
                <div className="news-section__tabs" role="tablist" aria-label="Release window">
                  {TAB_LABELS.map((item) => (
                    <Chip
                      key={item.id}
                      variant="nav"
                      active={tab === item.id}
                      aria-current={tab === item.id ? 'page' : undefined}
                      onClick={() => setTab(item.id)}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {list.length === 0 ? (
                <p className="news-page__empty">{EMPTY_STATES.noNewsReleases}</p>
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
                        <a
                          className="news-release-row"
                          href={storeUrl(release.appid)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${release.name} on Steam Store`}
                        >
                          <ReleaseRowContent release={release} />
                        </a>
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
                <ul className="news-library-list">
                  {payload.libraryNews.map((item) => (
                    <li key={`${item.appid}-${item.url}-${item.date}`} className="news-library-list__item">
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
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function ReleaseRowContent({ release }: { release: NewsRelease }): React.ReactElement {
  const daysLabel = formatReleaseDaysFromToday(release.releaseUnix)

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
        {onOpenGame ? (
          <button type="button" className="news-library-row__game" onClick={onOpenGame}>
            {item.gameName}
          </button>
        ) : (
          <span className="news-library-row__game">{item.gameName}</span>
        )}
        <time className="news-library-row__date" dateTime={new Date(item.date * 1000).toISOString()}>
          {formatNewsDate(item.date)}
        </time>
      </div>
      <a
        className="news-library-row__title"
        href={item.url}
        target="_blank"
        rel="noreferrer"
      >
        {item.title}
      </a>
      {item.contents ? <p className="news-library-row__excerpt">{item.contents}</p> : null}
    </article>
  )
}
