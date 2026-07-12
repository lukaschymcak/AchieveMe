import type { RawAchievement, SourceId } from '../../../shared/types'
import { parseCreamApiAchievements } from './creamApiParser'
import { parseCodexAchievements } from './codexParser'
import { parseGoldbergAchievements } from './goldbergParser'
import { parseHoodlumAchievements } from './hoodlumParser'
import { parseReloadedAchievements } from './reloadedParser'

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
    case 'hoodlum':
      return parseHoodlumAchievements(filePath)
    case 'reloaded':
      return parseReloadedAchievements(filePath)
    case 'creamapi':
      return parseCreamApiAchievements(filePath)
    default:
      return {}
  }
}
