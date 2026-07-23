import type { Achievement, SessionRecapUnlock, TrophyTier, ToastTier } from './types'

/** Sessions shorter than this do not show a recap (launcher flashes). */
export const SESSION_RECAP_MIN_SECONDS = 60

function xpForTier(tier: TrophyTier | ToastTier): number {
  switch (tier) {
    case 'bronze':
      return 50
    case 'silver':
      return 100
    case 'gold':
      return 200
    case 'platinum':
      return 500
  }
}

export function shouldOfferSessionRecap(elapsedSeconds: number): boolean {
  return elapsedSeconds >= SESSION_RECAP_MIN_SECONDS
}

/** Achievements earned within [startSec, endSec] inclusive (unix seconds). */
export function unlocksInSessionWindow(
  achievements: Achievement[],
  startSec: number,
  endSec: number
): SessionRecapUnlock[] {
  return achievements
    .filter(
      (ach) =>
        ach.earned === 1 &&
        ach.earned_time > 0 &&
        ach.earned_time >= startSec &&
        ach.earned_time <= endSec
    )
    .sort((a, b) => a.earned_time - b.earned_time)
    .map((ach) => ({
      apiName: ach.api_name,
      displayName: ach.display_name,
      iconUrl: ach.icon_url || ach.icon_gray_url || '',
      tier: ach.trophy_tier
    }))
}

/** XP totals — matches toastXpForTier / profile scoring (50/100/200/500). */
export function xpForSessionUnlocks(unlocks: SessionRecapUnlock[]): number {
  return unlocks.reduce((sum, u) => sum + xpForTier(u.tier), 0)
}

/** Pick a stable random index in [0, length) — returns -1 when empty. */
export function pickRandomGameIndex(length: number, random = Math.random): number {
  if (length <= 0) return -1
  return Math.floor(random() * length)
}

/** Demo duration between 12 and 45 minutes (inclusive bounds via random). */
export function pickDemoSessionSeconds(random = Math.random): number {
  const min = 12 * 60
  const max = 45 * 60
  return Math.floor(min + random() * (max - min + 1))
}

/** Up to `limit` earned achievements for a preview recap (most recent first). */
export function pickDemoUnlocks(
  achievements: Achievement[],
  limit = 3
): SessionRecapUnlock[] {
  return achievements
    .filter((ach) => ach.earned === 1)
    .sort((a, b) => b.earned_time - a.earned_time)
    .slice(0, limit)
    .map((ach) => ({
      apiName: ach.api_name,
      displayName: ach.display_name,
      iconUrl: ach.icon_url || ach.icon_gray_url || '',
      tier: ach.trophy_tier as TrophyTier
    }))
}
