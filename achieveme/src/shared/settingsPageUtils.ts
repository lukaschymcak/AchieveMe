/**
 * Settings chrome and row copy. One term per concept — no Worker/Bearer on this surface.
 */
export const SETTINGS_COPY = {
  pageTitle: 'Settings',
  save: 'Save',
  saved: 'Saved',
  saveFailed: 'Save failed.',
  loadFailed: 'Couldn’t load settings.',
  retry: 'Retry',
  backupFailed: 'Backup failed.',
  browseFailed: 'Browse failed.',
  loading: 'Loading settings…',
  steamApiKey: 'Steam API key',
  getKey: 'Get key',
  getKeyOpens: 'Get key (opens in browser)',
  saveFolders: 'Save folders',
  installFolders: 'Install folders',
  add: 'Add',
  addGamesFolders: 'Add Games folders',
  unlockToasts: 'Unlock toasts',
  preview: 'Preview',
  unlockSound: 'Unlock sound',
  volume: 'Volume',
  customSound: 'Custom sound',
  sessionRecap: 'Session recap',
  closeToTray: 'Close to tray',
  launchAtStartup: 'Launch at startup',
  startupSetupOnly: 'Needs the installed Setup, not Portable.',
  startMinimized: 'Start minimized',
  hideOnGameStart: 'Hide on game start',
  trackPlaytime: 'Track playtime',
  ludusavi: 'Ludusavi',
  cloudUrl: 'Cloud URL',
  cloudToken: 'Cloud token',
  cloud: 'Cloud',
  downloadBackups: 'Download backups',
  downloading: 'Downloading…',
  autoBackup: 'Auto-backup after game ends',
  backupAllGames: 'All library games',
  backupNow: 'Backup now',
  steamless: 'Steamless',
  hubcapKey: 'Hubcap key',
  depotFolder: 'Depot folder',
  browse: 'Browse',
  clear: 'Clear',
  remove: 'Remove',
  ready: 'Ready',
  notSet: 'Not set',
  saveFirstThenDownload: 'Save first, then download.',
  downloadedBackups: 'Downloaded backups.',
  downloadFailed: 'Download failed.',
  setLudusaviThenSave: 'Set Ludusavi, then Save.',
  cloudConfirmLead: 'Download cloud backups for library games?',
  cloudConfirmBody:
    'Adds snapshots in Ludusavi. Live saves stay until you Install backup on Game Detail.',
  cloudNotConfigured: 'Set Cloud URL and token in Settings → Backups first.',
  appVersion: 'App version',
  checkForUpdates: 'Check for updates',
  checkingUpdates: 'Checking…',
  updateReady: 'Restart & install'
} as const

/**
 * Accessible names for Settings chips whose visible text repeats (Add, Preview, Browse, Clear).
 * Visible labels stay short; these names must stay unique.
 */
export const SETTINGS_CHIP_LABELS = {
  addSaveFolder: 'Add save folder',
  addInstallFolder: 'Add install folder',
  previewUnlockToasts: 'Preview unlock toasts',
  previewSessionRecap: 'Preview session recap',
  browseCustomSound: 'Browse custom sound',
  browseLudusavi: 'Browse Ludusavi',
  browseSteamless: 'Browse Steamless',
  browseDepotFolder: 'Browse depot folder',
  clearLudusavi: 'Clear Ludusavi',
  clearCloudUrl: 'Clear Cloud URL',
  clearCloudToken: 'Clear Cloud token',
  clearSteamless: 'Clear Steamless',
  clearHubcapKey: 'Clear Hubcap key',
  clearDepotFolder: 'Clear depot folder',
  checkForUpdates: 'Check for updates',
  installUpdate: 'Restart and install update'
} as const

/** Settings page group ids — one scroll, four headings. */
export const SETTINGS_GROUPS = [
  { id: 'library', title: 'Library' },
  { id: 'play', title: 'Play' },
  { id: 'backups', title: 'Backups' },
  { id: 'tools', title: 'Tools' }
] as const

export type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]['id']

const GROUP_TOOLTIP_KEYS = [
  'settingsLibrary',
  'settingsPlay',
  'settingsBackups',
  'settingsTools'
] as const

export type SettingsGroupTooltipKey = (typeof GROUP_TOOLTIP_KEYS)[number]

/**
 * Maps a Settings group id to its HelpTip key on TOOLTIPS.
 *
 * @param id - Settings group id.
 */
export function settingsGroupTooltipKey(id: SettingsGroupId): SettingsGroupTooltipKey {
  const key = `settings${id.charAt(0).toUpperCase()}${id.slice(1)}`
  return key as SettingsGroupTooltipKey
}

/**
 * Counts terminal sentences so Settings group HelpTips stay ≤2.
 *
 * @param text - Tooltip or label copy.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0).length
}

/**
 * Display label for an emulator source id.
 *
 * @param source - Source id from ALL_SOURCES.
 */
export function formatSourceLabel(source: string): string {
  if (source === 'gse') return 'GSE'
  if (!source) return source
  return source.charAt(0).toUpperCase() + source.slice(1)
}

/**
 * Builds Settings row class names for path, nested, and cluster-head variants.
 *
 * @param options - Row modifiers.
 */
export function settingsRowClassName(options: {
  disabled?: boolean
  nested?: boolean
  clusterHead?: boolean
  path?: boolean
}): string {
  return [
    'settings-row',
    options.disabled ? 'settings-row--disabled' : '',
    options.nested ? 'settings-row--nested' : '',
    options.clusterHead ? 'settings-row--cluster-head' : '',
    options.path ? 'settings-row--path' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Turns an unknown throw into chrome-status copy, with a fallback if empty.
 *
 * @param err - Caught rejection or throw.
 * @param fallback - Copy when the error has no usable message.
 */
export function settingsNoticeFromError(err: unknown, fallback: string): string {
  if (err == null) return fallback
  const message = err instanceof Error ? err.message : String(err)
  const trimmed = message.trim()
  if (!trimmed || trimmed === 'Error') return fallback
  return trimmed
}
