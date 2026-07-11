import type { RawAchievement } from '../../../shared/types'
import { iniKeyGet, parseIniFile } from './iniHelper'

export function parseOnlineFixAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    for (const [apiName, keys] of ini) {
      const ar = iniKeyGet(keys, 'achieved')
      const achieved = ar === 'true' || ar === '1'

      const ts = iniKeyGet(keys, 'timestamp')
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
