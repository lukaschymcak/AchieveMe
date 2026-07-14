import React from 'react'
import { APP_NAV_ITEMS, type AppPage } from '../../lib/appNavigation'
import Chip from './Chip'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
  'aria-label'?: string
}

export default function AppNav({
  page,
  onNavigate,
  'aria-label': ariaLabel = 'Main'
}: Props): React.ReactElement {
  return (
    <nav className="app-chrome__nav library-chrome__nav" aria-label={ariaLabel}>
      {APP_NAV_ITEMS.map((item) => (
        <Chip
          key={item.id}
          variant="nav"
          active={page === item.id}
          aria-current={page === item.id ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </Chip>
      ))}
    </nav>
  )
}
