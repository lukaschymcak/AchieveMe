import React, { useState } from 'react'
import type { AppUpdateState } from '../../../shared/types'

interface Props {
  updateState: AppUpdateState | null
  onInstall: () => void
}

export default function UpdateBanner({ updateState, onInstall }: Props): React.ReactElement | null {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  if (!updateState) return null

  // If update is ready to install
  if (updateState.status === 'downloaded') {
    const key = updateState.newVersion || 'downloaded'
    if (dismissedVersion === key) return null

    return (
      <div className="update-banner" role="status" aria-live="polite">
        <div className="update-banner__content">
          <div className="update-banner__badge">UPDATE READY</div>
          <div className="update-banner__text">
            <span className="update-banner__title">
              AchieveMe {updateState.newVersion ? `v${updateState.newVersion}` : ''} is ready
            </span>
            <span className="update-banner__subtitle">
              The app will close and reopen updated — takes a few seconds.
            </span>
          </div>
        </div>
        <div className="update-banner__actions">
          <button
            type="button"
            className="library-chip library-chip--active"
            onClick={onInstall}
          >
            Restart now
          </button>
          <button
            type="button"
            className="library-chip"
            onClick={() => setDismissedVersion(key)}
            aria-label="Dismiss update notification"
          >
            Later
          </button>
        </div>
      </div>
    )
  }

  // If actively downloading in background
  if (updateState.status === 'downloading') {
    const pct = updateState.progressPercent ?? 0
    return (
      <div className="update-banner update-banner--downloading" role="status" aria-live="polite">
        <div className="update-banner__content">
          <div className="update-banner__badge">DOWNLOADING</div>
          <div className="update-banner__text">
            <span className="update-banner__title">
              Downloading update{updateState.newVersion ? ` v${updateState.newVersion}` : ''} ({pct}%)
            </span>
            <div className="update-banner__progress-bar">
              <div
                className="update-banner__progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
