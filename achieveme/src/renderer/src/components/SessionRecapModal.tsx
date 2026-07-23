import React from 'react'
import type { SessionRecapPayload } from '../../../shared/types'
import { formatPlaytimeCompact } from '../../../shared/playtimeUtils'

interface Props {
  payload: SessionRecapPayload
  onDismiss: () => void
}

export default function SessionRecapModal({ payload, onDismiss }: Props): React.ReactElement {
  const durationLabel = formatPlaytimeCompact(payload.durationSeconds)
  const hasUnlocks = payload.unlocks.length > 0

  return (
    <div className="help-overlay session-recap-overlay" role="presentation" onClick={onDismiss}>
      <div
        className="help-modal session-recap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-recap-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="session-recap-modal__eyebrow">Session recap</p>
        <h2 id="session-recap-title" className="help-modal__title session-recap-modal__title">
          {payload.gameName}
        </h2>

        <dl className="session-recap-modal__stats">
          <div className="session-recap-modal__stat">
            <dt>Time played</dt>
            <dd>{durationLabel === '—' ? '1m' : durationLabel}</dd>
          </div>
          <div className="session-recap-modal__stat">
            <dt>XP gained</dt>
            <dd>+{payload.xpGained}</dd>
          </div>
          <div className="session-recap-modal__stat">
            <dt>Unlocks</dt>
            <dd>{payload.unlocks.length}</dd>
          </div>
        </dl>

        {hasUnlocks ? (
          <ul className="session-recap-modal__unlocks">
            {payload.unlocks.map((u) => (
              <li key={u.apiName} className="session-recap-modal__unlock">
                {u.iconUrl ? (
                  <img
                    className="session-recap-modal__icon"
                    src={u.iconUrl}
                    alt=""
                    width={36}
                    height={36}
                  />
                ) : (
                  <span className="session-recap-modal__icon session-recap-modal__icon--empty" />
                )}
                <span className="session-recap-modal__unlock-body">
                  <span className="session-recap-modal__unlock-name">{u.displayName}</span>
                  <span className={`session-recap-modal__tier session-recap-modal__tier--${u.tier}`}>
                    {u.tier}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="session-recap-modal__empty">No unlocks this session</p>
        )}

        <div className="help-modal__actions">
          <button type="button" className="help-modal__primary" onClick={onDismiss}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
