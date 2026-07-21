import type { Achievement } from '../../shared/types'

export interface UnlockChange {
  apiName: string
  displayName: string
  earnedTime: number
}

export interface ProgressChange {
  apiName: string
  displayName: string
  progress: number
  maxProgress: number
}

export interface AchievementDiffResult {
  unlocked: UnlockChange[]
  progressUpdated: ProgressChange[]
}

/** Compare achievement rows before and after a save sync. */
export function diffAchievements(
  previous: Achievement[],
  next: Achievement[]
): AchievementDiffResult {
  const prevMap = new Map(previous.map((a) => [a.api_name, a]))
  const unlocked: UnlockChange[] = []
  const progressUpdated: ProgressChange[] = []

  for (const ach of next) {
    const prev = prevMap.get(ach.api_name)

    if (ach.earned === 1 && (!prev || prev.earned !== 1)) {
      unlocked.push({
        apiName: ach.api_name,
        displayName: ach.display_name,
        earnedTime: ach.earned_time
      })
    }

    const maxProgress = ach.max_progress ?? 0
    const progress = ach.progress ?? 0
    if (maxProgress > 0 && ach.earned !== 1) {
      const prevProgress = prev?.progress ?? 0
      if (progress > prevProgress) {
        progressUpdated.push({
          apiName: ach.api_name,
          displayName: ach.display_name,
          progress,
          maxProgress
        })
      }
    }
  }

  return { unlocked, progressUpdated }
}
