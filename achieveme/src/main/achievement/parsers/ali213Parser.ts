import type { RawAchievement } from '../../../shared/types'
import { iniKeyGet, parseIniFile } from './iniHelper'

export function parseAli213Achievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    for (const [apiName, keys] of ini) {
      const ha = iniKeyGet(keys, 'HaveAchieved')
      const achieved = (parseInt(ha ?? '0', 10) || 0) === 1

      const hat = iniKeyGet(keys, 'HaveAchievedTime')
      const unlockTime = hat !== undefined ? parseInt(hat, 10) || 0 : 0

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
