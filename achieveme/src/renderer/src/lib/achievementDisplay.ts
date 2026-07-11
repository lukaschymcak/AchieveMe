import { normalizeSteamIconUrl } from '../../../shared/steamUrls'

export function achievementIconSrc(
  appid: string,
  earned: number,
  iconUrl: string,
  iconGrayUrl: string
): string {
  if (earned) return normalizeSteamIconUrl(appid, iconUrl)
  return normalizeSteamIconUrl(appid, iconGrayUrl)
}

export function achievementDescription(
  description: string,
  hidden: number,
  earned: number,
  showHidden: boolean
): string | null {
  if (description.trim()) return description
  if (hidden && !earned) {
    return showHidden ? 'Hidden achievement' : null
  }
  if (hidden && earned) {
    return 'Steam does not provide descriptions for hidden achievements'
  }
  return null
}

export function isHiddenAchievement(hidden: number | undefined): boolean {
  return hidden === 1
}
