import type { RawAchievement } from '../../../shared/types'
import { iniKeyGet, parseIniFile } from './iniHelper'

export function parseCreamApiAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    for (const [apiName, keys] of ini) {
      const ach = iniKeyGet(keys, 'achieved')
      const achieved = (parseInt(ach ?? '0', 10) || 0) === 1

      const utRaw = iniKeyGet(keys, 'unlocktime')
      let unlockTime = 0
      if (utRaw !== undefined) {
        const parsed = parseInt(utRaw, 10)
        if (!isNaN(parsed)) {
          // Some versions store milliseconds (7-digit numbers) — convert to seconds
          unlockTime = utRaw.trim().length === 7 ? parsed * 1000 : parsed
        }
      }

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
