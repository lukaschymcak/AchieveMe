// Supported emulator sources (Goldberg-family saves are writable on import).
export type SourceId =
  | 'goldberg'
  | 'gse'
  | 'codex'
  | 'rune'

export type TrophyTier = 'bronze' | 'silver' | 'gold'

/** Toast chrome tiers — achievement unlocks use TrophyTier; platinum is 100% game celebration. */
export type ToastTier = TrophyTier | 'platinum'

export const ALL_SOURCES: SourceId[] = [
  'goldberg',
  'gse',
  'codex',
  'rune'
]

// What a parsed emulator save file gives us per achievement
export interface RawAchievement {
  achieved: boolean
  unlockTime: number // unix seconds, 0 if not earned
  progress?: number
  maxProgress?: number
}

// Persisted in settings.json inside userData
export interface AppSettings {
  steamApiKey: string
  enabledSources: SourceId[]
  customWatchFolders: string[]
  notificationsEnabled: boolean
  closeToTray: boolean
  soundEnabled: boolean
  customSoundPath: string
  playtimeTrackingEnabled: boolean
}

export interface UnlockChange {
  apiName: string
  displayName: string
  earnedTime: number
  iconUrl: string
  tier: TrophyTier
}

/** Payload sent to the unlock toast overlay window. */
export interface UnlockToastPayload {
  appid: string
  gameName: string
  displayName: string
  iconUrl: string
  tier: ToastTier
}

// One row in the `games` SQLite table
export interface Game {
  appid: string
  name: string
  total_achievements: number
  unlocked_achievements: number
  completion_pct: number
  has_platinum: number // 0 or 1 (SQLite has no boolean)
  last_unlocked_at: number // unix seconds
  schema_fetched_at: number // unix seconds
  playtime_seconds: number
  install_path: string
}

// One row in the `achievements` SQLite table
export interface Achievement {
  appid: string
  api_name: string
  display_name: string
  description: string
  icon_url: string
  icon_gray_url: string
  global_percent: number
  earned: number // 0 or 1
  earned_time: number // unix seconds
  trophy_tier: TrophyTier
  hidden: number // 0 or 1 (SQLite has no boolean)
  progress: number
  max_progress: number
}

export interface RecentUnlock {
  appid: string
  gameName: string
  achievementName: string
  tier: TrophyTier
  earnedAt: number
}

export interface NearCompletionGame {
  appid: string
  name: string
  completionPct: number
}

// Written to profile_stats.json for instant dashboard reads
export interface ProfileStats {
  totalGames: number
  totalUnlocked: number
  platinum: number
  gold: number
  silver: number
  bronze: number
  level: number
  xp: number
  libraryCompletionPct: number
  recentUnlocks: RecentUnlock[]
  nearCompletionGames: NearCompletionGame[]
  // e.g. [{ month: "2024-01", count: 5 }, ...]
  monthlyActivity: Array<{ month: string; count: number }>
  totalPlaytimeSeconds: number
}

// Sent over IPC to renderer for the game list page
export interface GameSummary {
  appid: string
  name: string
  cover_url: string
  total_achievements: number
  unlocked_achievements: number
  completion_pct: number
  has_platinum: boolean
  last_unlocked_at: number
  playtime_seconds: number
}

// Sent over IPC to renderer for the game detail page
export interface GameDetail {
  game: Game
  achievements: Achievement[]
  cover_url: string
  backdrop_url: string
}

/** Goldberg-style save progress (matches achievements.json on disk). */
export type GoldbergProgress = Record<
  string,
  {
    earned: boolean
    earned_time: number
    progress?: number
    max_progress?: number
  }
>

export interface PortableSaveFile {
  appid: string
  source: SourceId
  format: 'goldberg-json'
  rootKind: 'default' | 'custom'
  rootSource: SourceId
  customRoot?: string
  relativePath: string
  progress: GoldbergProgress
}

export interface ExportBundleV2 {
  formatVersion: 2
  exportedAt: string
  games: Game[]
  achievements: Achievement[]
  saveFiles: PortableSaveFile[]
}

export type ExportBundle = ExportBundleV2

export interface SaveLocation {
  appid: string
  source: SourceId
  file_path: string
  root_kind: 'default' | 'custom'
  root_source: SourceId
  custom_root: string
  relative_path: string
  updated_at: number
}

export interface ImportResult {
  gamesImported: number
  saveFilesWritten: number
  filesWritten: number
  errors: string[]
}

export interface PortableFolder {
  appid: string
  source: SourceId
  rootKind: 'default' | 'custom'
  rootSource: SourceId
  customRoot?: string
  relativePath: string
  archivePath: string
}

export interface FullBackupManifest {
  formatVersion: 3
  exportedAt: string
  games: Game[]
  achievements: Achievement[]
  folders: PortableFolder[]
}

export interface SteamSearchResult {
  appid: string
  name: string
  imageUrl: string | null
}

export interface GoldbergApplyRequest {
  appid: string
  dllPath: string
}

export interface LibraryUpdatedPayload {
  appid?: string
}

export interface SteamApiDllInfo {
  path: string
  fileName: string
  directory: string
  architecture: 'x86' | 'x64'
}

export interface GameFolderInfo {
  gameDir: string
  hasSteamSettings: boolean
  dllInfo: SteamApiDllInfo | null
}
