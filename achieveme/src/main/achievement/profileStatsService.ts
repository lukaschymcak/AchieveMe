import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type Database from 'better-sqlite3'
import type { ProfileStats } from '../../shared/types'
import {
  computeLevelProgress,
  computeLibraryCompletionPct,
  computeProfileXp,
  pickNearCompletionGames,
  pickRecentUnlocks
} from '../../shared/profileStatsUtils'
import { getAllGames, getAllEarnedAchievements } from '../db/repository'

export {
  computeLevelProgress,
  computeLibraryCompletionPct,
  normalizeProfileStats,
  pickNearCompletionGames,
  pickRecentUnlocks
} from '../../shared/profileStatsUtils'

export function regenerateProfileStats(db: Database.Database): void {
  const games = getAllGames(db)
  const earned = getAllEarnedAchievements(db)
  const gameNames = new Map(games.map((game) => [game.appid, game.name]))

  let bronze = 0
  let silver = 0
  let gold = 0
  let platinum = 0

  for (const game of games) {
    if (game.has_platinum === 1) platinum++
  }

  for (const ach of earned) {
    if (ach.trophy_tier === 'gold') gold++
    else if (ach.trophy_tier === 'silver') silver++
    else bronze++
  }

  const xp = computeProfileXp({ bronze, silver, gold, platinum })
  const { level } = computeLevelProgress(xp)

  const monthlyCounts = new Map<string, number>()
  for (const ach of earned) {
    if (!ach.earned_time || ach.earned_time <= 0) continue
    const date = new Date(ach.earned_time * 1000)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1)
  }

  const monthlyActivity = Array.from(monthlyCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  const stats: ProfileStats = {
    totalGames: games.length,
    totalUnlocked: earned.length,
    platinum,
    gold,
    silver,
    bronze,
    level,
    xp,
    libraryCompletionPct: computeLibraryCompletionPct(games),
    recentUnlocks: pickRecentUnlocks(earned, gameNames),
    nearCompletionGames: pickNearCompletionGames(games),
    monthlyActivity
  }

  const statsPath = path.join(app.getPath('userData'), 'profile_stats.json')
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8')
}
