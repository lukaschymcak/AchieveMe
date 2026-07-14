export type AppPage = 'dashboard' | 'library' | 'settings' | 'help'

export const APP_NAV_ITEMS: Array<{ id: AppPage; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'library', label: 'Library' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' }
]
