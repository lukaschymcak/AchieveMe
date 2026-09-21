import React from 'react'
import type { PendingChangelog } from '../../../shared/types'
import { parseChangelogNotes, type ParsedChangelogItem } from '../../../shared/changelogUtils'

interface Props {
  payload: PendingChangelog
  onDismiss: () => void
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return null
  }
}

export default function ChangelogModal({ payload, onDismiss }: Props): React.ReactElement {
  const items = React.useMemo(() => parseChangelogNotes(payload.notes), [payload.notes])
  const formattedDate = formatDate(payload.releaseDate)
  const cleanVersion = payload.version.replace(/^v/, '')

  return (
    <div className="help-overlay changelog-modal-overlay" role="presentation" onClick={onDismiss}>
      <div
        className="help-modal changelog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="changelog-modal__header">
          <div className="changelog-modal__title-row">
            <div>
              <p className="changelog-modal__eyebrow">UPDATE INSTALLED</p>
              <h2 id="changelog-title" className="help-modal__title changelog-modal__title">
                What&apos;s New
              </h2>
            </div>
            <div className="changelog-modal__version-badge">
              <span className="changelog-modal__version-label">v{cleanVersion}</span>
              {formattedDate && <span className="changelog-modal__date">{formattedDate}</span>}
            </div>
          </div>
        </div>

        <div className="changelog-modal__body">
          {items.length === 0 ? (
            <p className="changelog-modal__empty">No detailed release notes available.</p>
          ) : (
            <ul className="changelog-modal__list">
              {items.map((item: ParsedChangelogItem) => (
                <li key={item.id} className={`changelog-item changelog-item--${item.type}`}>
                  {item.tag ? (
                    <div className="changelog-item__line">
                      <span className={`changelog-badge changelog-badge--${item.tag}`}>
                        {item.tag}
                      </span>
                      {item.scope && (
                        <span className="changelog-item__scope">({item.scope})</span>
                      )}
                      <span className="changelog-item__text">{item.text}</span>
                    </div>
                  ) : item.type === 'bullet' ? (
                    <div className="changelog-item__line">
                      <span className="changelog-item__bullet-dot" aria-hidden="true" />
                      <span className="changelog-item__text">{item.text}</span>
                    </div>
                  ) : (
                    <p className="changelog-item__paragraph">{item.text}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="help-modal__actions">
          <button
            type="button"
            className="help-modal__primary changelog-modal__dismiss"
            onClick={onDismiss}
            autoFocus
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
