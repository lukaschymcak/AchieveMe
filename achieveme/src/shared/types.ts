// Supported emulator sources (Goldberg-family saves are writable on import).
import type { UpdateTransferPhase } from './updateTransferUtils'

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
  /**
   * Disk roots scanned by Tools → Scan for installed games (Steam-shaped folders).
   * Not used by emulator save discovery — keep separate from customWatchFolders.
   */
  installScanRoots: string[]
  notificationsEnabled: boolean
  closeToTray: boolean
  /** When true, register AchieveMe in the OS login items list. */
  openAtLogin: boolean
  /** When true with openAtLogin, login launch passes --hidden (tray only). */
  startMinimizedToTray: boolean
  /**
   * When true, hide the main window to the tray when a tracked play session starts.
   * Default false — does not surprise users.
   */
  hideToTrayOnGameStart: boolean
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
  /**
   * Steam username passed as GSE_CFG_USERNAME env var to generate_emu_config.exe.
   * Prevents the interactive username prompt when setting up Goldberg achievements.
   */
  gseUsername: string
  /**
   * Steam password passed as GSE_CFG_PASSWORD env var to generate_emu_config.exe.
   * Stored in settings.json; treat as sensitive.
   */
  gsePassword: string
  /** Absolute path to user-linked ludusavi.exe, or empty. */
  ludusaviPath: string
  /**
   * Legacy rclone path (unused after R2 cloud saves).
   * Kept so old settings.json files still load.
   */
  rclonePath: string
  /**
   * Legacy global “upload after backup” flag. Ignored by the product path;
   * per-game `cloud_saves_enabled` controls R2 upload instead.
   * Kept so old settings.json files still load.
   */
  ludusaviCloudSync: boolean
  /**
   * Legacy provider cache (unused after R2 cloud saves).
   * Kept so old settings.json files still load.
   */
  ludusaviCloudProvider: string
  /** Legacy custom rclone remote (unused). Kept for settings.json compatibility. */
  ludusaviCloudCustomRemote: string
  /** Cloudflare Worker base URL for cloud saves (https), or empty. */
  cloudSavesApiUrl: string
  /** Bearer token for the cloud saves Worker, or empty. */
  cloudSavesApiToken: string
  /** Master switch: automatic Ludusavi backup after a tracked play session ends. */
  ludusaviAutoBackup: boolean
  /**
   * Legacy: ignored. Startup auto-backup was removed; kept for settings file compat.
   * @deprecated
   */
  ludusaviBackupOnStartup: boolean
  /**
   * Legacy: ignored. Session auto-backup is controlled by `ludusaviAutoBackup`.
   * @deprecated
   */
  ludusaviBackupOnSessionEnd: boolean
  /**
   * Legacy: ignored. Add-game auto-backup was removed; kept for settings file compat.
   * @deprecated
   */
  ludusaviBackupOnAddGame: boolean
}

export interface UnlockChange {
  apiName: string
  displayName: string
  description: string
  earnedTime: number
  iconUrl: string
  tier: TrophyTier
}

/** Payload sent to the unlock toast overlay window. */
export interface UnlockToastPayload {
  appid: string
  gameName: string
  displayName: string
  description: string
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
  /** Display name for dock / modal header. */
  gameName: string
  /** Modal phase for UpdateTransferModal. */
  phase: UpdateTransferPhase
  /** Absolute install folder used for DepotDownloader. */
  installPath: string
  /** Depots confirmed for the in-flight job. */
  selectedDepots?: string[]
  /** Snapshot: Steamless was applied before this update. */
  steamlessApplied: boolean
  /** Snapshot: Goldberg was applied before this update. */
  goldbergApplied: boolean
  /** Last known Steamless exe path for reapply. */
  steamlessExe: string
  /** Last known Goldberg DLL path for reapply. */
  goldbergDllPath: string
  /** Optional header art for modal chrome. */
  headerImageUrl?: string
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
  /** Optional CLI args for Play (spawn path). Empty when none. */
  launch_args: string
  /** Epoch ms when the current play session started, or 0 when idle. */
  playtime_session_started_at: number
  /** Epoch ms of the last playtime flush during an open session, or 0 when idle. */
  playtime_last_flush_at: number
  /** JSON `{ depotId: gid }` baseline from DepotWizard, or empty. */
  manifest_gids: string
  /** Last known Steam update status from PICS check. */
  update_status: UpdateStatus
  /**
   * Ludusavi backup status for this library game.
   * Empty = never attempted; `ok` | `failed` | `missing` | `running`.
   */
  backup_status: string
  /** Unix seconds of last successful or failed backup attempt. */
  backup_at: number
  /** Last backup error message, or empty. */
  backup_error: string
  /** Cached Ludusavi manifest title resolved via find --steam-id. */
  ludusavi_title: string
  /**
   * 1 when this game should auto-upload to R2 after a successful local backup.
   * Default 0 (off). Requires Worker URL + token in settings.
   */
  cloud_saves_enabled: number
  /** 1 when Steamless was successfully applied for this game. */
  steamless_applied: number
  /** 1 when Goldberg was successfully applied for this game. */
  goldberg_applied: number
  /** Last Steamless target exe path, or empty. */
  steamless_exe: string
  /** Last Goldberg steam_api DLL path, or empty. */
  goldberg_dll_path: string
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
  backup_status: string
  backup_at: number
  backup_error: string
  ludusavi_title: string
  /** 1 when this game auto-uploads to R2 after local backup. */
  cloud_saves_enabled: number
  /** True when stored `manifest_gids` has at least one depot GID. */
  has_depot_gids: boolean
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

export interface SteamSearchResult {
  appid: string
  name: string
  imageUrl: string | null
}

/** Steam Store hunter stats for Game Detail (HLTB deferred). */
export interface GameHunterStats {
  readonly reviewPercent: number | null
  readonly reviewCount: number | null
  readonly metacritic: number | null
  /** Steam `review_score_desc` e.g. "Very Positive" when available. */
  readonly reviewSummary: string | null
  /** True when at least one display field is present. */
  readonly hasAny: boolean
}

/** Steam review sentiment tone for colored UI. */
export type SteamReviewTone = 'positive' | 'mixed' | 'negative' | 'neutral'

/** Metacritic score color band. */
export type MetacriticBand = 'high' | 'mid' | 'low'

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
  /** True when ranking suggests this exe for Play (not redist/crash tools). */
  suggested?: boolean
}

/** Config payload when saving Play install/exe paths. */
export interface SetGameLaunchConfigRequest {
  appid: string
  installPath?: string
  launchExe: string
  /** Optional CLI args string; omit to leave unchanged. */
  launchArgs?: string
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

/** One candidate from Tools → Scan for installed games. */
export interface ScannedInstallCandidate {
  appid: string
  guessedName: string
  installPath: string
  suggestedExe: string
  alreadyInLibrary: boolean
  ignored: boolean
}

/** Add or update a scanned install (no Hubcap GIDs). */
export interface ImportScannedInstallRequest {
  appid: string
  gameName: string
  installPath: string
  launchExe?: string
}

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

/** One Steam store release row on the News page. */
export interface NewsRelease {
  appid: string
  name: string
  releaseLabel: string
  headerImage: string
  /** Unix seconds when known; null for TBA / Coming soon. */
  releaseUnix: number | null
  inLibrary: boolean
  /** Steam store tag IDs from search HTML (empty when missing). */
  tagIds: number[]
}

/** One Steam community announcement for a library game. */
export interface LibraryNewsItem {
  appid: string
  gameName: string
  title: string
  url: string
  /** Unix seconds. */
  date: number
  contents: string
  feedLabel: string
}

/** Full News page payload from `get-news`. */
export interface NewsPayload {
  /** Popular Steam titles releasing (or released) within 7 days. */
  thisWeek: NewsRelease[]
  /** Popular Steam titles releasing in 8–31 days. */
  thisMonth: NewsRelease[]
  libraryNews: LibraryNewsItem[]
  fetchedAt: number
  fromCache: boolean
}

/** Options for `get-news` / `window.api.getNews`. */
export interface GetNewsOptions {
  forceRefresh?: boolean
}

/** One row in the Wanted collection (Library chrome rail). */
export interface WantedGame {
  appid: string
  name: string
  coverUrl: string
  /** Unix seconds when pinned / added. */
  addedAt: number
}

/** Result of `wanted:add` (pin or Add Wanted modal). */
export type WantedAddResult =
  | { ok: true; game: WantedGame; created: boolean }
  | { ok: false; reason: 'invalid-appid' | 'in-library' }

/** Boot splash warm progress (main → renderer via `boot:warm-progress`). */
export interface BootWarmProgress {
  phase: 'prune' | 'library' | 'games' | 'news' | 'done' | 'error'
  current: number
  total: number
  label: string
}

/** Result of `boot:run-warm`. */
export interface BootWarmResult {
  ok: boolean
  gamesWarmed: number
  gamesFailed: number
  errorMessage?: string
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

/** In-app updater lifecycle states */
export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

/** Detailed state for auto-updates (version, progress, release notes) */
export interface AppUpdateState {
  status: AppUpdateStatus
  currentVersion: string
  newVersion?: string
  releaseDate?: string
  releaseNotes?: string
  progressPercent?: number
  bytesPerSecond?: number
  transferredBytes?: number
  totalBytes?: number
  error?: string
  devMode?: boolean
  checkedAt?: number
}

