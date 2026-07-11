// Every emulator source we support. GreenLuma is excluded (registry-only, out of scope).
export type SourceId =
  | 'goldberg'
  | 'gse'
  | 'empress'
  | 'codex'
  | 'rune'
  | 'onlinefix'
  | 'smartsteamemu'
  | 'skidrow'
  | 'darksiders'
  | 'ali213'
  | 'hoodlum'
  | 'creamapi'
  | 'reloaded'

export type TrophyTier = 'bronze' | 'silver' | 'gold'

export const ALL_SOURCES: SourceId[] = [
  'goldberg',
  'gse',
  'empress',
  'codex',
  'rune',
  'onlinefix',
  'smartsteamemu',
  'skidrow',
  'darksiders',
  'ali213',
  'hoodlum',
  'creamapi',
  'reloaded'
]

// What a parsed emulator save file gives us per achievement
export interface RawAchievement {
  achieved: boolean
  unlockTime: number // unix seconds, 0 if not earned
}

// Persisted in settings.json inside userData
export interface AppSettings {
  steamApiKey: string
  enabledSources: SourceId[]
  customWatchFolders: string[]
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
  // e.g. [{ month: "2024-01", count: 5 }, ...]
  monthlyActivity: Array<{ month: string; count: number }>
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
}

// Sent over IPC to renderer for the game detail page
export interface GameDetail {
  game: Game
  achievements: Achievement[]
  cover_url: string
}
