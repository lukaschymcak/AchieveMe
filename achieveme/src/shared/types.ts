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
  /** When true, register AchieveMe in the OS login items list. */
  openAtLogin: boolean
  /** When true with openAtLogin, login launch passes --hidden (tray only). */
  startMinimizedToTray: boolean
  soundEnabled: boolean
  /** Unlock sound loudness from 0 (silent) to 100 (full). */
  soundVolume: number
  customSoundPath: string
  playtimeTrackingEnabled: boolean
  sessionRecapEnabled: boolean
  /** When true, game detail shows Play / Select exe / Set install folder controls. */
  playGamesFromLauncher: boolean
  /** Absolute path to a user-linked Steamless install folder, or empty. */
  steamlessFolder: string
  /** Hubcap / Morrenus API key for manifest downloads (Bearer token). */
  hubcapApiKey: string
  /** Default folder for DepotDownloader output, or empty to ask each time. */
  depotDownloadPath: string
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

/** One unlock listed on a session recap. */
export interface SessionRecapUnlock {
  apiName: string
  displayName: string
  iconUrl: string
  tier: TrophyTier
}

/** Payload for the post-session recap modal. */
export interface SessionRecapPayload {
  appid: string
  gameName: string
  durationSeconds: number
  xpGained: number
  unlocks: SessionRecapUnlock[]
}

/** Live Steam PICS update status relative to stored manifest GIDs. */
export type UpdateStatus = 'up_to_date' | 'update_available' | ''

/** One depot row returned by a Steam PICS product-info query. */
export interface ManifestCheckResult {
  appId: string
  depotId: string
  manifestGid: string
  buildId?: string
}

/** Result of checking one game and persisting `update_status`. */
export interface ManifestCheckGameResult {
  status: UpdateStatus
  rows: ManifestCheckResult[]
  buildId?: string
}

/** In-flight update or validate job tracked at the App shell so progress survives navigation. */
export interface ActiveUpdateSession {
  appid: string
  mode: 'update' | 'validate'
  busy: boolean
  pct: number
  label: string
  error: string
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
  /** Absolute path to the chosen game .exe for Play, or empty. */
  launch_exe: string
  /** JSON `{ depotId: gid }` baseline from DepotWizard, or empty. */
  manifest_gids: string
  /** Last known Steam update status from PICS check. */
  update_status: UpdateStatus
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
  install_path: string
  launch_exe: string
  update_status: UpdateStatus
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
  /** When true, backup and replace the game steam_api DLL with Goldberg regular emu. */
  installEmuDll: boolean
  /**
   * When true, keep existing configs.user/overlay/app/main.ini under steam_settings
   * after replace (Denuvo offline-activated games).
   */
  denuvoOfflineActivated: boolean
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

/** One executable found under a game install / game-root folder. */
export interface GameExecutable {
  name: string
  relativePath: string
  absolutePath: string
}

/** Config payload when saving Play install/exe paths. */
export interface SetGameLaunchConfigRequest {
  appid: string
  installPath?: string
  launchExe: string
}

/**
 * Result of resolving the game root and listing executables for Play.
 * - `ready` — root known; `executables` may be empty.
 * - `confirm_root` — folder name is only a possible match; ask the user.
 * - `need_browse` — no candidate; user must pick a folder.
 */
export type ResolveGameExecutablesResult =
  | { status: 'ready'; root: string; executables: GameExecutable[] }
  | { status: 'confirm_root'; candidatePath: string }
  | { status: 'need_browse' }

/** Error code from launchGame when the UI should open the exe picker. */
export const LAUNCH_NEEDS_EXE = 'LAUNCH_NEEDS_EXE' as const

/** Result of running the linked Steamless.CLI on an executable. */
export interface SteamlessRunResult {
  ok: boolean
  exitCode: number
  log: string
  unpackedPath: string | null
}

export interface GameFolderInfo {
  gameDir: string
  hasSteamSettings: boolean
  dllInfo: SteamApiDllInfo | null
}

/** One depot parsed from a Hubcap manifest Lua file. */
export interface DepotInfo {
  key: string
  description: string
  size: number
}

/** Parsed Hubcap manifest ZIP contents for DepotDownloader. */
export interface GameData {
  appId: string
  gameName: string
  installDir?: string
  buildId?: string
  depots: Record<string, DepotInfo>
  dlcs: Record<string, string>
  manifests: Record<string, string>
  selectedDepots: string[]
  manifestZipPath?: string
  headerImageUrl?: string
}

/** Steam Store search result enriched for the Depot Downloader wizard. */
export interface DepotSearchResult {
  gameId: string
  gameName: string
  headerImageUrl?: string
  relevanceScore?: number
  type?: 'game' | 'dlc'
  shortDescription?: string
  releaseYear?: number
  dlcCount?: number
}

export interface DepotSearchResponse {
  mode: 'games' | 'dlc'
  results: DepotSearchResult[]
  total: number
  label: string
  baseGame?: DepotSearchResult
}

export interface HubcapUserStats {
  username?: string
  dailyUsage: number
  dailyLimit: number
  error?: string
}

export type DepotCancelMode = 'keep' | 'delete'
export type DepotHealthState = 'stable' | 'retrying' | 'warning' | 'degraded'
export type DepotPhase =
  | 'search'
  | 'fetching'
  | 'depots'
  | 'downloading'
  | 'prompt'
  | 'dll'
  | 'emu'
  | 'apply'
  | 'complete'
  | 'canceled'
  | 'failed'

/** Request payload to start a DepotDownloader run. */
export interface DepotDownloadStartRequest {
  gameData: GameData
  selectedDepots: string[]
  libraryPath: string
  outputPath?: string
  steamUsername?: string
  maxDownloads: number
  channelId: string
}

/** Progress / log event pushed from main to renderer during a depot download. */
export interface DepotProgressEvent {
  channelId?: string
  appId?: string
  gameName?: string
  headerImageUrl?: string
  pct?: number
  log?: string
  received?: number
  total?: number
  totalBytes?: number
  status?: string
  done?: boolean
  error?: string
  canceled?: boolean
  terminalReason?: 'completed' | 'failed' | 'canceled'
  speedBps?: number | null
  diskBps?: number | null
  etaSec?: number | null
  indeterminate?: boolean
  healthState?: DepotHealthState
  retryCountRecent?: number
  lastHealthMessage?: string
  startedAt?: number
}

/**
 * Live depot download session kept in App.tsx so the wizard can close
 * and reopen without losing progress.
 */
export interface ActiveDepotSession {
  channelId: string
  appId: string
  gameName: string
  headerImageUrl?: string
  phase: DepotPhase
  gameData: GameData | null
  selectedDepots: string[]
  outputPath: string
  zipPath?: string
  logs: string[]
  pct: number
  speedBps: number | null
  etaSec: number | null
  status: string
  error?: string
  dllInfo?: SteamApiDllInfo | null
  installEmuDll?: boolean
  denuvoOfflineActivated?: boolean
}
