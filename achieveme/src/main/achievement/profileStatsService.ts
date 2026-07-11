import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type Database from 'better-sqlite3'
import type { ProfileStats } from '../../shared/types'
import { getAllGames, getAllEarnedAchievements } from '../db/repository'

export function regenerateProfileStats(db: Database.Database): void {
  const games = getAllGames(db)
  const earned = getAllEarnedAchievements(db)

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

  const xp = bronze * 50 + silver * 100 + gold * 200 + platinum * 500
  const level = Math.floor(xp / 1000)

  // Monthly activity — count unlocks per YYYY-MM
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

  const totalUnlocked = earned.length

  const stats: ProfileStats = {
    totalGames: games.length,
    totalUnlocked,
    platinum,
    gold,
    silver,
    bronze,
    level,
    xp,
    monthlyActivity
  }

  const statsPath = path.join(app.getPath('userData'), 'profile_stats.json')
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8')
}
