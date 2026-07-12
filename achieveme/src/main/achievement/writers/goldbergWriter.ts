import fs from 'node:fs'
import path from 'node:path'
import type { RawAchievement } from '../../../shared/types'

export function buildGoldbergJson(progress: Record<string, RawAchievement>): string {
  const root: Record<string, { earned: boolean; earned_time: number }> = {}

  for (const [apiName, ach] of Object.entries(progress)) {
    root[apiName] = {
      earned: ach.achieved,
      earned_time: ach.achieved ? ach.unlockTime : 0
    }
  }

  return JSON.stringify(root, null, 2)
}

export function writeGoldbergSave(filePath: string, progress: Record<string, RawAchievement>): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, buildGoldbergJson(progress), 'utf8')
}
