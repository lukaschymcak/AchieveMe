import React from 'react'
import { FIRST_RUN, HELP_STORAGE_KEYS } from '../lib/helpContent'

interface Props {
  onDismiss: () => void
}

export default function FirstRunWelcome({ onDismiss }: Props): React.ReactElement {
  function handleDismiss(): void {
    localStorage.setItem(HELP_STORAGE_KEYS.firstRunSeen, '1')
    onDismiss()
  }

  return (
    <div className="help-overlay" role="presentation">
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <h2 id="first-run-title" className="help-modal__title">
          {FIRST_RUN.title}
        </h2>
        <p className="help-modal__lead">{FIRST_RUN.intro}</p>
        <ul className="help-modal__list">
          {FIRST_RUN.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="help-modal__actions">
          <button type="button" className="help-modal__primary" onClick={handleDismiss}>
            {FIRST_RUN.dismiss}
          </button>
        </div>
      </div>
    </div>
  )
}
