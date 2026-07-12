import type { RawAchievement, SourceId } from '../../shared/types'

// Higher index = higher trust. Goldberg is most trusted.
const SOURCE_PRIORITY: SourceId[] = [
  'hoodlum',
  'rune',
  'reloaded',
  'creamapi',
  'codex',
  'gse',
  'goldberg'
]

export function mergeRawAchievements(
  rows: Array<{ source: SourceId; raw: Record<string, RawAchievement> }>
): Record<string, RawAchievement> {
  const merged: Record<string, RawAchievement> = {}

  // Sort ascending by priority so the highest-priority source writes last and wins
  const sorted = [...rows].sort((a, b) => {
    return SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
  })

  for (const { raw } of sorted) {
    for (const [apiName, value] of Object.entries(raw)) {
      const prev = merged[apiName]

      if (!prev) {
        merged[apiName] = { achieved: value.achieved, unlockTime: value.unlockTime }
        continue
      }

      // If either source says earned, it's earned. Keep the later timestamp.
      const achieved = prev.achieved || value.achieved
      merged[apiName] = {
        achieved,
        unlockTime: achieved ? Math.max(prev.unlockTime, value.unlockTime) : 0
      }
    }
  }

  return merged
}
