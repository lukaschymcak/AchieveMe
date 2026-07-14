import type { Achievement, Game, NearCompletionGame, ProfileStats, RecentUnlock } from './types'

const XP_PER_LEVEL = 1000
export const RECENT_UNLOCK_LIMIT = 5
export const NEAR_COMPLETION_LIMIT = 3
export const NEAR_COMPLETION_MIN_PCT = 50

export function computeLevelProgress(xp: number): {
  level: number
  xpInLevel: number
  xpToNext: number
  levelPct: number
} {
  const level = Math.floor(xp / XP_PER_LEVEL)
  const xpInLevel = xp % XP_PER_LEVEL
  const xpToNext = XP_PER_LEVEL - xpInLevel
  const levelPct = xpInLevel === 0 && xp > 0 ? 100 : Math.round((xpInLevel / XP_PER_LEVEL) * 100)

  return { level, xpInLevel, xpToNext, levelPct }
}

export function computeLibraryCompletionPct(games: Game[]): number {
  const trackable = games.filter((game) => game.total_achievements > 0)
  if (trackable.length === 0) {
    return 0
  }

  const totalPct = trackable.reduce((sum, game) => sum + game.completion_pct, 0)
  return Math.round(totalPct / trackable.length)
}

export function pickRecentUnlocks(
  earned: Achievement[],
  gameNames: Map<string, string>,
  limit = RECENT_UNLOCK_LIMIT
): RecentUnlock[] {
  return [...earned]
    .filter((ach) => ach.earned_time > 0)
    .sort((a, b) => b.earned_time - a.earned_time)
    .slice(0, limit)
    .map((ach) => ({
      appid: ach.appid,
      gameName: gameNames.get(ach.appid) ?? ach.appid,
      achievementName: ach.display_name,
      tier: ach.trophy_tier,
      earnedAt: ach.earned_time
    }))
}

export function pickNearCompletionGames(
  games: Game[],
  limit = NEAR_COMPLETION_LIMIT
): NearCompletionGame[] {
  return games
    .filter(
      (game) =>
        game.total_achievements > 0 &&
        game.completion_pct >= NEAR_COMPLETION_MIN_PCT &&
        game.completion_pct < 100
    )
    .sort((a, b) => b.completion_pct - a.completion_pct)
    .slice(0, limit)
    .map((game) => ({
      appid: game.appid,
      name: game.name,
      completionPct: game.completion_pct
    }))
}

export function normalizeProfileStats(raw: Partial<ProfileStats>): ProfileStats {
  const xp = raw.xp ?? 0
  const { level } = computeLevelProgress(xp)

  return {
    totalGames: raw.totalGames ?? 0,
    totalUnlocked: raw.totalUnlocked ?? 0,
    platinum: raw.platinum ?? 0,
    gold: raw.gold ?? 0,
    silver: raw.silver ?? 0,
    bronze: raw.bronze ?? 0,
    level: raw.level ?? level,
    xp,
    libraryCompletionPct: raw.libraryCompletionPct ?? 0,
    recentUnlocks: raw.recentUnlocks ?? [],
    nearCompletionGames: raw.nearCompletionGames ?? [],
    monthlyActivity: raw.monthlyActivity ?? []
  }
}

export function computeProfileXp(tierCounts: {
  bronze: number
  silver: number
  gold: number
  platinum: number
}): number {
  return (
    tierCounts.bronze * 50 +
    tierCounts.silver * 100 +
    tierCounts.gold * 200 +
    tierCounts.platinum * 500
  )
}
