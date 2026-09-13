import React, { useEffect, useState } from 'react'
import type { BootWarmProgress } from '../../../shared/types'
import {
  BOOT_STAGES,
  getBootPhaseIndex,
  formatBootStatus
} from '../../../shared/bootSplashUtils'

type Props = {
  progress: BootWarmProgress | null
  isExiting?: boolean
  onSkip?: () => void
}

/**
 * Bespoke Trophy Crest Vector Emblem.
 * Merges PlayStation-style trophy geometry, completion ring arc, and platinum ✦ star.
 */
function TrophyCrest(): React.ReactElement {
  return (
    <div className="boot-splash__crest" aria-hidden="true">
      <svg
        className="boot-splash__crest-svg"
        viewBox="0 0 96 96"
        width="88"
        height="88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="crest-metal" x1="16" y1="12" x2="80" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(95% 0.025 285)" />
            <stop offset="45%" stopColor="oklch(84% 0.04 280)" />
            <stop offset="70%" stopColor="oklch(60% 0.025 275)" />
            <stop offset="100%" stopColor="oklch(40% 0.018 275)" />
          </linearGradient>

          <linearGradient id="crest-glow" x1="48" y1="20" x2="48" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(70% 0.14 230)" />
            <stop offset="100%" stopColor="oklch(45% 0.08 230)" />
          </linearGradient>

          <radialGradient id="crest-core" cx="48" cy="48" r="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(60% 0.12 230 / 0.35)" />
            <stop offset="60%" stopColor="oklch(40% 0.06 275 / 0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <filter id="crest-star-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient background disc */}
        <circle cx="48" cy="48" r="42" fill="url(#crest-core)" />

        {/* Outer completion ring guide arc */}
        <circle
          cx="48"
          cy="48"
          r="41"
          stroke="oklch(38% 0.02 275)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
          className="boot-splash__crest-ring"
        />

        {/* Inner solid arc highlight */}
        <path
          d="M20 48 A28 28 0 0 1 76 48"
          stroke="url(#crest-glow)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Trophy cup body */}
        <path
          d="M32 30 H64 V44 C64 53 57 60 48 60 C39 60 32 53 32 44 Z"
          fill="oklch(18% 0.016 275)"
          stroke="url(#crest-metal)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Inner cup facet line */}
        <path
          d="M48 30 V59"
          stroke="url(#crest-metal)"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.6"
        />

        {/* Trophy handles */}
        <path
          d="M32 34 C24 34 20 40 20 46 C20 54 26 58 33 57"
          stroke="url(#crest-metal)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M64 34 C72 34 76 40 76 46 C76 54 70 58 63 57"
          stroke="url(#crest-metal)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Trophy pedestal & stem */}
        <path
          d="M44 60 H52 V68 H44 Z"
          fill="url(#crest-metal)"
          opacity="0.9"
        />
        <path
          d="M36 68 H60 L62 74 H34 Z"
          fill="oklch(22% 0.018 275)"
          stroke="url(#crest-metal)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Platinum Star ✦ (Hovering over the trophy cup) */}
        <g filter="url(#crest-star-glow)">
          <path
            d="M48 14 L49.8 20.2 L56 22 L49.8 23.8 L48 30 L46.2 23.8 L40 22 L46.2 20.2 Z"
            fill="oklch(95% 0.035 285)"
            className="boot-splash__crest-star"
          />
        </g>
      </svg>
    </div>
  )
}

/**
 * Full-window branded splash shown until boot warm completes.
 * Incorporates Trophy Case aesthetics, pipeline stepper, precision meter, and smooth exit.
 */
export default function BootSplash({
  progress,
  isExiting = false,
  onSkip
}: Props): React.ReactElement {
  const [canSkip, setCanSkip] = useState(false)
  const currentPhase = progress?.phase
  const activeStageIdx = getBootPhaseIndex(currentPhase)
  const status = formatBootStatus(
    currentPhase,
    progress?.label,
    progress?.current ?? 0,
    progress?.total ?? 0
  )

  // Show skip affordance after 2.5s if warming takes longer than instant cache hit
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanSkip(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard shortcut: Escape allows skipping directly to library
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && onSkip) {
        e.preventDefault()
        onSkip()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSkip])

  return (
    <div
      className={`boot-splash${isExiting ? ' boot-splash--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!isExiting}
    >
      {/* Ambient background atmosphere */}
      <div className="boot-splash__aura" aria-hidden="true" />
      <div className="boot-splash__grid" aria-hidden="true" />

      <div className="boot-splash__container">
        {/* Crest Insignia */}
        <TrophyCrest />

        {/* Wordmark & Subtitle */}
        <div className="boot-splash__header">
          <h1 className="boot-splash__brand">AchieveMe</h1>
          <p className="boot-splash__subtitle">
            <span className="boot-splash__subtitle-badge">TROPHY CASE</span>
            <span className="boot-splash__subtitle-sep">·</span>
            <span>PROGRESS SHOWCASE</span>
          </p>
        </div>

        {/* Milestone Pipeline Stepper */}
        <nav className="boot-splash__stepper" aria-label="Startup phases">
          {BOOT_STAGES.map((stage, idx) => {
            const isCompleted = activeStageIdx > idx || activeStageIdx === 4
            const isCurrent = activeStageIdx === idx

            return (
              <div
                key={stage.id}
                className={`boot-splash__step ${
                  isCurrent
                    ? 'boot-splash__step--current'
                    : isCompleted
                      ? 'boot-splash__step--completed'
                      : 'boot-splash__step--pending'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="boot-splash__step-indicator">
                  {isCompleted ? (
                    <span className="boot-splash__step-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="boot-splash__step-dot" aria-hidden="true" />
                  )}
                </div>
                <span className="boot-splash__step-label">{stage.short}</span>
              </div>
            )
          })}
        </nav>

        {/* Progress Display & Meter */}
        <div className="boot-splash__meter-box">
          <div className="boot-splash__meta">
            <span className="boot-splash__stage-title">{status.stageTitle}</span>
            {status.percent !== null ? (
              <span className="boot-splash__percent" aria-hidden="true">
                {status.percent}%
              </span>
            ) : null}
          </div>

          <div
            className={`boot-splash__bar ${
              status.isDeterminate ? 'boot-splash__bar--determinate' : 'boot-splash__bar--indeterminate'
            }`}
            role="progressbar"
            aria-valuenow={status.percent ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={status.detailLabel}
          >
            <div
              className="boot-splash__bar-fill"
              style={
                status.isDeterminate
                  ? { width: `${status.percent}%` }
                  : undefined
              }
            />
          </div>

          <div className="boot-splash__status-row">
            <p className="boot-splash__detail-label">{status.detailLabel}</p>
            {status.showCount && progress ? (
              <span className="boot-splash__count-badge" aria-hidden="true">
                {progress.current} / {progress.total}
              </span>
            ) : null}
          </div>
        </div>

        {/* System Telemetry & Skip Affordance */}
        <div className="boot-splash__footer">
          <span className="boot-splash__telemetry">LOCAL SQLITE ARCHIVE · OFFLINE READY</span>
          {canSkip && onSkip ? (
            <button
              type="button"
              className="boot-splash__skip-btn"
              onClick={onSkip}
              title="Skip startup checks and open library immediately"
            >
              Skip to Library <kbd className="boot-splash__kbd">ESC</kbd>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
