import type { RawAchievement } from '../../../shared/types'
import { getIniSection, iniKeyGet, parseIniFile } from './iniHelper'

export function parseHoodlumAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    const achievements = getIniSection(ini, 'Achievements')
    if (!achievements) return result

    const timestamps = getIniSection(ini, 'AchievementsUnlockTimes') ?? new Map<string, string>()

    for (const [apiName, rawState] of achievements) {
      const achieved = (parseInt(rawState, 10) || 0) === 1

      const ts = iniKeyGet(timestamps, apiName)
      const unlockTime = ts !== undefined ? parseInt(ts, 10) || 0 : 0

      result[apiName] = {
        achieved,
        unlockTime: achieved ? unlockTime : 0
      }
    }
  } catch {
    return result
  }

  return result
}
