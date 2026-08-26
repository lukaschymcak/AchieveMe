export type AppPage = 'dashboard' | 'library' | 'news' | 'tools' | 'settings' | 'help'

export const APP_NAV_ITEMS: Array<{ id: AppPage; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'library', label: 'Library' },
  { id: 'news', label: 'News' },
  { id: 'tools', label: 'Tools' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' }
]
