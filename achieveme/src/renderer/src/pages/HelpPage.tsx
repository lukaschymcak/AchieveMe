import React from 'react'
import { AppChrome, AppNav, AppShell } from '../components/app'
import type { AppPage } from '../lib/appNavigation'
import { HELP_SECTIONS } from '../lib/helpContent'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
}

export default function HelpPage({ page, onNavigate }: Props): React.ReactElement {
  const sectionCountLabel = `${HELP_SECTIONS.length} ${
    HELP_SECTIONS.length === 1 ? 'section' : 'sections'
  }`

  return (
    <AppShell column>
      <AppChrome
        left={<AppNav page={page} onNavigate={onNavigate} />}
        right={
          <span className="app-chrome__count library-chrome__count" aria-live="polite">
            {sectionCountLabel}
          </span>
        }
      />

      <div className="help-page">
        <header className="help-page__header">
          <h1 className="help-page__title">Help &amp; Guide</h1>
          <p className="help-page__intro">
            How AchieveMe discovers games, syncs progress, and uses your settings. Look for{' '}
            <span className="help-page__tip-demo" aria-hidden>
              ?
            </span>{' '}
            tips throughout the app for quick explanations.
          </p>
        </header>

        <div className="help-page__sections">
          {HELP_SECTIONS.map((section) => (
            <section key={section.id} id={`help-${section.id}`} className="help-page__section">
              <h2 className="help-page__section-title">{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="help-page__paragraph">
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="help-page__list">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
