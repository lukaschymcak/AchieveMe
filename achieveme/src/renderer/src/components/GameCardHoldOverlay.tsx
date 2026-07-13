import React from 'react'

interface Props {
  classPrefix: 'library-card' | 'library-list-row'
  isHolding: boolean
  menuOpen: boolean
  holdDurationMs?: number
}

export default function GameCardHoldOverlay({
  classPrefix,
  isHolding,
  menuOpen,
  holdDurationMs = 380
}: Props): React.ReactElement | null {
  if (!isHolding && !menuOpen) return null

  const overlayClass = [
    `${classPrefix}__hold-overlay`,
    menuOpen && `${classPrefix}__hold-overlay--settled`
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={overlayClass}
      aria-hidden
      style={
        isHolding && !menuOpen
          ? ({ '--hold-duration': `${holdDurationMs}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {isHolding && !menuOpen && <div className={`${classPrefix}__hold-progress`} />}
    </div>
  )
}
