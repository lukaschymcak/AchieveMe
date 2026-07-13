import type { Achievement } from '../../../shared/types'
import { normalizeSteamIconUrl } from '../../../shared/steamUrls'

export { achievementDescription, isHiddenAchievement } from './achievementDescription'

export type DisplayTier = 'platinum' | 'gold' | 'silver' | 'bronze'
export type ActiveFilter = 'all' | DisplayTier

export interface PlatinumEntry {
  kind: 'platinum'
  earned: boolean
  gameName: string
}

export interface TierGroup {
  tier: DisplayTier
  items: (Achievement | PlatinumEntry)[]
}

const ACHIEVEMENT_TIERS: DisplayTier[] = ['gold', 'silver', 'bronze']

function sortByEarnedThenName(a: Achievement, b: Achievement): number {
  if (a.earned !== b.earned) return b.earned - a.earned
  return a.display_name.localeCompare(b.display_name)
}

export function isPlatinumEntry(item: Achievement | PlatinumEntry): item is PlatinumEntry {
  return 'kind' in item && item.kind === 'platinum'
}

export function groupAchievementsByTier(
  achievements: Achievement[],
  hasPlatinum: boolean,
  gameName: string
): TierGroup[] {
  if (achievements.length === 0) return []

  const groups: TierGroup[] = []

  groups.push({
    tier: 'platinum',
    items: [{ kind: 'platinum', earned: hasPlatinum, gameName }]
  })

  for (const tier of ACHIEVEMENT_TIERS) {
    const items = achievements.filter((a) => a.trophy_tier === tier).sort(sortByEarnedThenName)
    if (items.length > 0) {
      groups.push({ tier, items })
    }
  }

  return groups
}

export function getTierGroup(
  groups: TierGroup[],
  tier: DisplayTier
): TierGroup | undefined {
  return groups.find((g) => g.tier === tier)
}

export function countEarnedInTier(
  group: TierGroup | undefined,
  tier: DisplayTier
): number {
  if (!group) return 0
  if (tier === 'platinum') {
    const entry = group.items[0]
    return isPlatinumEntry(entry) && entry.earned ? 1 : 0
  }
  return group.items.filter((item): item is Achievement => !isPlatinumEntry(item) && item.earned === 1)
    .length
}

export function tierLabel(tier: DisplayTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function achievementIconSrc(
  appid: string,
  earned: number,
  iconUrl: string,
  iconGrayUrl: string
): string {
  if (earned) return normalizeSteamIconUrl(appid, iconUrl)
  return normalizeSteamIconUrl(appid, iconGrayUrl)
}

