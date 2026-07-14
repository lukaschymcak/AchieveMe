import React from 'react'

interface Props {
  centered?: boolean
  /** Constrains chrome + page body to the same centered column as Dashboard (not Library). */
  column?: boolean
  children: React.ReactNode
  className?: string
}

export default function AppShell({
  centered = false,
  column = false,
  children,
  className = ''
}: Props): React.ReactElement {
  const rootClass = [
    'app-page',
    'library',
    centered ? 'app-page--centered library--centered' : '',
    column ? 'app-page--doc-column' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={rootClass}>{children}</div>
}
