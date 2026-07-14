import type { RawAchievement, SourceId } from '../../../shared/types'
import { parseCodexAchievements } from './codexParser'
import { parseGoldbergAchievements } from './goldbergParser'

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
    default:
      return {}
  }
}
