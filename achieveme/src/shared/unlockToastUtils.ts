import type { ToastTier } from './types'

export const TOAST_PREVIEW_TIERS: readonly ToastTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum'
] as const

const PREVIEW_NAMES: Record<ToastTier, string> = {
  bronze: 'Warming Up',
  silver: 'Steady Progress',
  gold: 'First Blood',
  platinum: 'All achievements unlocked'
}

export function toastPreviewTierAt(index: number): ToastTier {
  const len = TOAST_PREVIEW_TIERS.length
  return TOAST_PREVIEW_TIERS[((index % len) + len) % len]!
}

export function nextToastPreviewIndex(index: number): number {
  return (index + 1) % TOAST_PREVIEW_TIERS.length
}

export function toastPreviewDisplayName(tier: ToastTier): string {
  return PREVIEW_NAMES[tier]
}

export function toastEyebrow(tier: ToastTier): string {
  return tier === 'platinum' ? 'Platinum!' : 'Unlocked!'
}

/** XP awarded for toast tier — matches profileStatsUtils scoring. */
export function toastXpForTier(tier: ToastTier): number {
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

export function formatToastXp(tier: ToastTier): string {
  return `+${toastXpForTier(tier)}`
}

/** True when a known game first reaches 100% completion (platinum). */
export function isNewPlatinum(
  hadPriorRows: boolean,
  previousHasPlatinum: number,
  nextHasPlatinum: number
): boolean {
  return hadPriorRows && previousHasPlatinum !== 1 && nextHasPlatinum === 1
}
