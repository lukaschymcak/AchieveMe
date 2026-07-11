import type { RawAchievement } from '../../../shared/types'
import { getIniSection, iniKeyGet, parseIniFile } from './iniHelper'

// Reads a 4-byte little-endian uint32 from an 8-char hex string
function hexToUInt32LE(hex: string): number {
  if (!hex || hex.length < 8) return 0
  try {
    const bytes = Buffer.alloc(4)
    for (let i = 0; i < 4; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes.readUInt32LE(0)
  } catch {
    return 0
  }
}

export function parseReloadedAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  try {
    const ini = parseIniFile(filePath)
    const stateSection = getIniSection(ini, 'State')
    const timeSection = getIniSection(ini, 'Time')

    if (stateSection && timeSection) {
      // Two-section format
      for (const [apiName, stateVal] of stateSection) {
        const achieved = stateVal === '0101'
        const timeRaw = iniKeyGet(timeSection, apiName)
        const unlockTime = timeRaw !== undefined ? hexToUInt32LE(timeRaw) : 0
        result[apiName] = {
          achieved,
          unlockTime: achieved ? unlockTime : 0
        }
      }
    } else {
      // Per-section format: each section = achievement name
      for (const [apiName, keys] of ini) {
        const st = iniKeyGet(keys, 'State')
        const achieved = st !== undefined ? hexToUInt32LE(st) === 1 : false

        const tm = iniKeyGet(keys, 'Time')
        const unlockTime = tm !== undefined ? hexToUInt32LE(tm) : 0

        result[apiName] = {
          achieved,
          unlockTime: achieved ? unlockTime : 0
        }
      }
    }
  } catch {
    return result
  }

  return result
}
