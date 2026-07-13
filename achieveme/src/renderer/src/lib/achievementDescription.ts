export function achievementDescription(
  description: string,
  hidden: number,
  earned: number,
  showDescriptions: boolean
): string | null {
  const isHidden = hidden === 1
  const isEarned = earned === 1

  if (isHidden && !isEarned && !showDescriptions) {
    return null
  }
  if (description.trim()) {
    return description
  }
  if (isHidden && !isEarned && showDescriptions) {
    return 'Hidden achievement'
  }
  return null
}

export function isHiddenAchievement(hidden: number | undefined): boolean {
  return hidden === 1
}
