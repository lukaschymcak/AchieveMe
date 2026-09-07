import type { AppSettings, SourceId } from './types'

const ALL_SOURCES: SourceId[] = ['goldberg', 'gse', 'codex', 'rune']

/**
 * Clamps unlock sound volume to an integer in 0–100.
 * Kept local so settings tests can load this module without ESM extension issues.
 *
 * @param value - Raw volume from settings JSON
 */
const clampSoundVolumeLocal = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 100
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  steamApiKey: '',
  enabledSources: [...ALL_SOURCES],
  customWatchFolders: [],
  installScanRoots: [],
  notificationsEnabled: true,
  closeToTray: true,
  openAtLogin: false,
  startMinimizedToTray: false,
  hideToTrayOnGameStart: false,
  soundEnabled: true,
  soundVolume: 100,
  customSoundPath: '',
  playtimeTrackingEnabled: true,
  sessionRecapEnabled: true,
  playGamesFromLauncher: true,
  steamlessFolder: '',
  hubcapApiKey: '',
  depotDownloadPath: '',
  ludusaviPath: '',
  rclonePath: '',
  ludusaviCloudSync: false,
  ludusaviCloudProvider: 'none',
  ludusaviCloudCustomRemote: '',
  ludusaviAutoBackup: false,
  ludusaviBackupOnStartup: true,
  ludusaviBackupOnSessionEnd: true,
  ludusaviBackupOnAddGame: true
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
    installScanRoots: Array.isArray(parsed?.installScanRoots)
      ? parsed.installScanRoots.filter((p): p is string => typeof p === 'string')
      : DEFAULT_APP_SETTINGS.installScanRoots,
    notificationsEnabled:
      parsed?.notificationsEnabled ?? DEFAULT_APP_SETTINGS.notificationsEnabled,
    closeToTray: parsed?.closeToTray ?? DEFAULT_APP_SETTINGS.closeToTray,
    openAtLogin: parsed?.openAtLogin ?? DEFAULT_APP_SETTINGS.openAtLogin,
    startMinimizedToTray:
      parsed?.startMinimizedToTray ?? DEFAULT_APP_SETTINGS.startMinimizedToTray,
    hideToTrayOnGameStart:
      parsed?.hideToTrayOnGameStart ?? DEFAULT_APP_SETTINGS.hideToTrayOnGameStart,
    soundEnabled: parsed?.soundEnabled ?? DEFAULT_APP_SETTINGS.soundEnabled,
    soundVolume: clampSoundVolumeLocal(
      parsed?.soundVolume ?? DEFAULT_APP_SETTINGS.soundVolume
    ),
    customSoundPath: parsed?.customSoundPath ?? DEFAULT_APP_SETTINGS.customSoundPath,
    playtimeTrackingEnabled:
      parsed?.playtimeTrackingEnabled ?? DEFAULT_APP_SETTINGS.playtimeTrackingEnabled,
    sessionRecapEnabled:
      parsed?.sessionRecapEnabled ?? DEFAULT_APP_SETTINGS.sessionRecapEnabled,
    playGamesFromLauncher:
      parsed?.playGamesFromLauncher ?? DEFAULT_APP_SETTINGS.playGamesFromLauncher,
    steamlessFolder: parsed?.steamlessFolder ?? DEFAULT_APP_SETTINGS.steamlessFolder,
    hubcapApiKey: parsed?.hubcapApiKey ?? DEFAULT_APP_SETTINGS.hubcapApiKey,
    depotDownloadPath: parsed?.depotDownloadPath ?? DEFAULT_APP_SETTINGS.depotDownloadPath,
    ludusaviPath: parsed?.ludusaviPath ?? DEFAULT_APP_SETTINGS.ludusaviPath,
    rclonePath: parsed?.rclonePath ?? DEFAULT_APP_SETTINGS.rclonePath,
    ludusaviCloudSync: parsed?.ludusaviCloudSync ?? DEFAULT_APP_SETTINGS.ludusaviCloudSync,
    ludusaviCloudProvider:
      parsed?.ludusaviCloudProvider ?? DEFAULT_APP_SETTINGS.ludusaviCloudProvider,
    ludusaviCloudCustomRemote:
      parsed?.ludusaviCloudCustomRemote ?? DEFAULT_APP_SETTINGS.ludusaviCloudCustomRemote,
    ludusaviAutoBackup: parsed?.ludusaviAutoBackup ?? DEFAULT_APP_SETTINGS.ludusaviAutoBackup,
    ludusaviBackupOnStartup:
      parsed?.ludusaviBackupOnStartup ?? DEFAULT_APP_SETTINGS.ludusaviBackupOnStartup,
    ludusaviBackupOnSessionEnd:
      parsed?.ludusaviBackupOnSessionEnd ?? DEFAULT_APP_SETTINGS.ludusaviBackupOnSessionEnd,
    ludusaviBackupOnAddGame:
      parsed?.ludusaviBackupOnAddGame ?? DEFAULT_APP_SETTINGS.ludusaviBackupOnAddGame
  }
}
