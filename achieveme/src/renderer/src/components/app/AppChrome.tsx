import React from 'react'

interface Props {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
  toolbar?: React.ReactNode
  /** Pin chrome to the scrollport so live-region errors stay on-screen. */
  sticky?: boolean
}

export default function AppChrome({
  left,
  center,
  right,
  toolbar,
  sticky = false
}: Props): React.ReactElement {
  const wrapClass = [
    'app-chrome-wrap',
    'library-chrome-wrap',
    sticky ? 'app-chrome-wrap--sticky library-chrome-wrap--sticky' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapClass}>
      <header className="app-chrome library-chrome">
        {left != null && (
          <div className="app-chrome__left library-chrome__left">{left}</div>
        )}
        {center != null && (
          <div className="app-chrome__search-wrap library-chrome__search-wrap">
            {center}
          </div>
        )}
        {right != null && (
          <div className="app-chrome__right library-chrome__right">{right}</div>
        )}
      </header>
      <div
        className={`app-chrome__toolbar library-chrome__toolbar${
          toolbar == null ? ' app-chrome__toolbar--spacer' : ''
        }`}
      >
        {toolbar}
      </div>
    </div>
  )
}
