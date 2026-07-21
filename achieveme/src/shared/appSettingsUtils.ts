import type { AppSettings, SourceId } from './types'

const ALL_SOURCES: SourceId[] = ['goldberg', 'gse', 'codex', 'rune']

export const DEFAULT_APP_SETTINGS: AppSettings = {
  steamApiKey: '',
  enabledSources: [...ALL_SOURCES],
  customWatchFolders: [],
  notificationsEnabled: true,
  closeToTray: true,
  soundEnabled: true,
  customSoundPath: '',
  playtimeTrackingEnabled: true
}

export function normalizeAppSettings(
  parsed: Partial<AppSettings> | null | undefined
): AppSettings {
  const enabledSources = (parsed?.enabledSources ?? DEFAULT_APP_SETTINGS.enabledSources).filter(
    (s) => ALL_SOURCES.includes(s)
  )

  return {
    steamApiKey: parsed?.steamApiKey ?? DEFAULT_APP_SETTINGS.steamApiKey,
    enabledSources: enabledSources.length > 0 ? enabledSources : [...ALL_SOURCES],
    customWatchFolders: parsed?.customWatchFolders ?? DEFAULT_APP_SETTINGS.customWatchFolders,
    notificationsEnabled:
      parsed?.notificationsEnabled ?? DEFAULT_APP_SETTINGS.notificationsEnabled,
    closeToTray: parsed?.closeToTray ?? DEFAULT_APP_SETTINGS.closeToTray,
    soundEnabled: parsed?.soundEnabled ?? DEFAULT_APP_SETTINGS.soundEnabled,
    customSoundPath: parsed?.customSoundPath ?? DEFAULT_APP_SETTINGS.customSoundPath,
    playtimeTrackingEnabled:
      parsed?.playtimeTrackingEnabled ?? DEFAULT_APP_SETTINGS.playtimeTrackingEnabled
  }
}
