import fs from 'node:fs'
import path from 'node:path'
import type { RawAchievement } from '../../../shared/types'

export function buildGoldbergJson(progress: Record<string, RawAchievement>): string {
  const root: Record<
    string,
    {
      earned: boolean
      earned_time: number
      progress?: number
      max_progress?: number
    }
  > = {}

  for (const [apiName, ach] of Object.entries(progress)) {
    const entry: {
      earned: boolean
      earned_time: number
      progress?: number
      max_progress?: number
    } = {
      earned: ach.achieved,
      earned_time: ach.achieved ? ach.unlockTime : 0
    }

    const maxProgress = ach.maxProgress ?? 0
    if (maxProgress > 0) {
      entry.progress = ach.progress ?? 0
      entry.max_progress = maxProgress
    }

    root[apiName] = entry
  }

  return JSON.stringify(root, null, 2)
}

export function writeGoldbergSave(filePath: string, progress: Record<string, RawAchievement>): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, buildGoldbergJson(progress), 'utf8')
}
