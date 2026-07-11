import type { RawAchievement } from '../../../shared/types'
import { getIniSection, parseIniFile } from './iniHelper'

export function parseSkidrowAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    const section = getIniSection(ini, 'AchievementsUnlockTimes')
    if (!section) return result

    for (const [apiName, raw] of section) {
      const unlockTime = parseInt(raw, 10) || 0
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
