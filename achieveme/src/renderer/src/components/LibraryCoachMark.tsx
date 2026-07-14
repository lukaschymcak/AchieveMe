import React from 'react'
import { HELP_STORAGE_KEYS, LONG_PRESS_HINT } from '../lib/helpContent'

interface Props {
  onDismiss: () => void
}

export default function LibraryCoachMark({ onDismiss }: Props): React.ReactElement {
  function handleDismiss(): void {
    localStorage.setItem(HELP_STORAGE_KEYS.longPressHintSeen, '1')
    onDismiss()
  }

  return (
    <aside className="library-coach-mark" role="note" aria-labelledby="long-press-hint-title">
      <div className="library-coach-mark__content">
        <p id="long-press-hint-title" className="library-coach-mark__title">
          {LONG_PRESS_HINT.title}
        </p>
        <p className="library-coach-mark__body">{LONG_PRESS_HINT.body}</p>
      </div>
      <button type="button" className="library-coach-mark__dismiss" onClick={handleDismiss}>
        {LONG_PRESS_HINT.dismiss}
      </button>
    </aside>
  )
}
