import type { RawAchievement } from '../../../shared/types'
import { iniKeyGet, parseIniFile } from './iniHelper'

export function parseCodexAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    for (const [apiName, keys] of ini) {
      const unlockRaw = iniKeyGet(keys, 'UnlockTime')
      const unlockTime = unlockRaw !== undefined ? parseInt(unlockRaw, 10) || 0 : 0
      result[apiName] = {
        achieved: unlockTime > 0,
        unlockTime
      }
    }
  } catch {
    return result
  }

  return result
}
