import type { ToastTier } from './types'

export const TOAST_PREVIEW_TIERS: readonly ToastTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum'
] as const

/** One Settings → Test notification sample (rarity + description length). */
export type ToastPreviewSample = {
  readonly tier: ToastTier
  readonly gameName: string
  readonly displayName: string
  readonly description: string
}

/**
 * Preview cycle: short / medium / long description toasts, then platinum.
 * Used by Settings → Test notification to exercise measured overlay width.
 */
export const TOAST_PREVIEW_SAMPLES: readonly ToastPreviewSample[] = [
  {
    tier: 'bronze',
    gameName: 'Short Desc Demo',
    displayName: 'Quick Win',
    description: 'Nice.'
  },
  {
    tier: 'silver',
    gameName: 'Medium Desc Demo',
    displayName: 'Steady Progress',
    description:
      'Complete a mid-length objective without taking too much damage along the way.'
  },
  {
    tier: 'gold',
    gameName: 'Long Desc Demo',
    displayName: 'Marathon Runner',
    description:
      'A deliberately long achievement description that should stretch the unlock toast toward its maximum width so you can verify measured resize clamping, two-line wrapping, and layout with rarity chrome and the XP pill still visible.'
  },
  {
    tier: 'platinum',
    gameName: 'Platinum Demo',
    displayName: 'All achievements unlocked',
    description: ''
  }
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

/**
 * Returns the Settings preview sample at `index` (wraps).
 *
 * @param index - Zero-based preview counter.
 */
export function toastPreviewSampleAt(index: number): ToastPreviewSample {
  const len = TOAST_PREVIEW_SAMPLES.length
  return TOAST_PREVIEW_SAMPLES[((index % len) + len) % len]!
}

export function nextToastPreviewIndex(index: number): number {
  return (index + 1) % TOAST_PREVIEW_SAMPLES.length
}

export function toastPreviewDisplayName(tier: ToastTier): string {
  return PREVIEW_NAMES[tier]
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
