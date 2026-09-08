import React from 'react'
import type { BootWarmProgress } from '../../../shared/types'

type Props = {
  progress: BootWarmProgress | null
}

/**
 * Full-window branded splash shown until boot warm completes.
 */
export default function BootSplash({ progress }: Props): React.ReactElement {
  const label = progress?.label ?? 'Starting…'
  const showCount =
    progress?.phase === 'games' &&
    typeof progress.total === 'number' &&
    progress.total > 0 &&
    progress.current > 0

  return (
    <div className="boot-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-splash__glow" aria-hidden="true" />
      <div className="boot-splash__content">
        <p className="boot-splash__brand">AchieveMe</p>
        <p className="boot-splash__status">{label}</p>
        {showCount ? (
          <p className="boot-splash__count">
            {progress.current} / {progress.total}
          </p>
        ) : null}
        <div className="boot-splash__bar" aria-hidden="true">
          <div className="boot-splash__bar-fill" />
        </div>
      </div>
    </div>
  )
}
