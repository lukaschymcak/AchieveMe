import fs from 'node:fs'
import type { RawAchievement } from '../../../shared/types'

export function parseGoldbergAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  let text: string
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch {
    return result
  }

  let root: Record<string, unknown>
  try {
    root = JSON.parse(text) as Record<string, unknown>
  } catch {
    return result
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) return result

  for (const [apiName, token] of Object.entries(root)) {
    if (!token || typeof token !== 'object' || Array.isArray(token)) continue

    const obj = token as Record<string, unknown>
    const earned = Boolean(obj['earned'])
    const t = obj['earned_time']
    const unlockTime = typeof t === 'number' ? t : Number(t) || 0

    result[apiName] = {
      achieved: earned,
      unlockTime: earned ? unlockTime : 0
    }
  }

  return result
}
