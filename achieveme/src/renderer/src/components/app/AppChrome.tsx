import React from 'react'

interface Props {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
  toolbar?: React.ReactNode
}

export default function AppChrome({
  left,
  center,
  right,
  toolbar
}: Props): React.ReactElement {
  return (
    <div className="app-chrome-wrap library-chrome-wrap">
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
