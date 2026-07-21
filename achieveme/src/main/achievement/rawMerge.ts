import type { RawAchievement, SourceId } from '../../shared/types'

// Higher index = higher trust. Goldberg is most trusted.
const SOURCE_PRIORITY: SourceId[] = [
  'rune',
  'codex',
  'gse',
  'goldberg'
]

function mergeProgress(prev?: RawAchievement, next?: RawAchievement): {
  progress?: number
  maxProgress?: number
} {
  const prevMax = prev?.maxProgress ?? 0
  const nextMax = next?.maxProgress ?? 0
  const maxProgress = Math.max(prevMax, nextMax)
  if (maxProgress <= 0) return {}

  const progress = Math.max(prev?.progress ?? 0, next?.progress ?? 0)
  return { progress, maxProgress }
}

export function mergeRawAchievements(
  rows: Array<{ source: SourceId; raw: Record<string, RawAchievement> }>
): Record<string, RawAchievement> {
  const merged: Record<string, RawAchievement> = {}

  const sorted = [...rows].sort((a, b) => {
    return SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
  })

  for (const { raw } of sorted) {
    for (const [apiName, value] of Object.entries(raw)) {
      const prev = merged[apiName]

      if (!prev) {
        merged[apiName] = { ...value }
        continue
      }

      const achieved = prev.achieved || value.achieved
      const progressFields = mergeProgress(prev, value)

      merged[apiName] = {
        achieved,
        unlockTime: achieved ? Math.max(prev.unlockTime, value.unlockTime) : 0,
        ...progressFields
      }
    }
  }

  return merged
}
