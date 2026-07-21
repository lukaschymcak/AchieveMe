import fs from 'node:fs'
import type { RawAchievement } from '../../../shared/types'

function readProgressFields(obj: Record<string, unknown>): { progress: number; maxProgress: number } {
  const progressRaw = obj['progress']
  const maxProgressRaw = obj['max_progress']
  const progress = typeof progressRaw === 'number' ? progressRaw : Number(progressRaw) || 0
  const maxProgress =
    typeof maxProgressRaw === 'number' ? maxProgressRaw : Number(maxProgressRaw) || 0

  return { progress, maxProgress }
}

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
    const { progress, maxProgress } = readProgressFields(obj)

    result[apiName] = {
      achieved: earned,
      unlockTime: earned ? unlockTime : 0,
      progress: maxProgress > 0 ? progress : undefined,
      maxProgress: maxProgress > 0 ? maxProgress : undefined
    }
  }

  return result
}
