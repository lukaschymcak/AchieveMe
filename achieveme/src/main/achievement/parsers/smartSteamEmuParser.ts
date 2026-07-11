import fs from 'node:fs'
import type { RawAchievement } from '../../../shared/types'

const RECORD_SIZE = 24

export function parseSmartSteamEmuAchievements(filePath: string): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  let fileBytes: Buffer
  try {
    fileBytes = fs.readFileSync(filePath)
  } catch {
    return result
  }

  if (fileBytes.length < 4) return result

  const expectedCount = fileBytes.readInt32LE(0)
  const dataStart = 4
  const actualCount = Math.floor((fileBytes.length - dataStart) / RECORD_SIZE)

  if (actualCount !== expectedCount) return result

  for (let i = 0; i < actualCount; i++) {
    const offset = dataStart + i * RECORD_SIZE
    try {
      const state = fileBytes.readInt32LE(offset + 20)
      if (state > 1) continue // invalid record

      const crc = fileBytes.readUInt32LE(offset)
      const apiName = crc.toString(16) // stored by CRC since we don't have the name

      const unlockTime = fileBytes.readInt32LE(offset + 8)

      result[apiName] = {
        achieved: state === 1,
        unlockTime: state === 1 ? unlockTime : 0
      }
    } catch {
      // Skip bad record
    }
  }

  return result
}
