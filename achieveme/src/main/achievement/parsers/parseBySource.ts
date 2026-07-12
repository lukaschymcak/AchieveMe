import type { RawAchievement, SourceId } from '../../../shared/types'
import { parseAli213Achievements } from './ali213Parser'
import { parseCreamApiAchievements } from './creamApiParser'
import { parseCodexAchievements } from './codexParser'
import { parseGoldbergAchievements } from './goldbergParser'
import { parseHoodlumAchievements } from './hoodlumParser'
import { parseOnlineFixAchievements } from './onlineFixParser'
import { parseReloadedAchievements } from './reloadedParser'
import { parseSkidrowAchievements } from './skidrowParser'
import { parseSmartSteamEmuAchievements } from './smartSteamEmuParser'

export function parseAchievementsBySource(
  source: SourceId,
  filePath: string
): Record<string, RawAchievement> {
  switch (source) {
    case 'goldberg':
    case 'gse':
      return parseGoldbergAchievements(filePath)
    case 'codex':
    case 'rune':
      return parseCodexAchievements(filePath)
    case 'onlinefix':
      return parseOnlineFixAchievements(filePath)
    case 'skidrow':
      return parseSkidrowAchievements(filePath)
    case 'darksiders':
    case 'hoodlum':
      return parseHoodlumAchievements(filePath)
    case 'reloaded':
      return parseReloadedAchievements(filePath)
    case 'creamapi':
      return parseCreamApiAchievements(filePath)
    case 'ali213':
      return parseAli213Achievements(filePath)
    case 'smartsteamemu':
      return parseSmartSteamEmuAchievements(filePath)
    default:
      return {}
  }
}
