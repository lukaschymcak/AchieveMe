import type { RawAchievement } from '../../../shared/types'
import { rawAchievementsFromIniSections } from '../../../shared/achievementSchemaUtils'
import { parseIniFile } from './iniHelper'

/**
 * Parses CODEX/RUNE `achievements.ini` unlock progress.
 * Only sections with an `UnlockTime` key count as achievements (meta blocks like
 * `[SteamAchievements] Count=0` are ignored).
 *
 * @param filePath - Absolute path to `achievements.ini`.
 */
export function parseCodexAchievements(filePath: string): Record<string, RawAchievement> {
  try {
    const ini = parseIniFile(filePath)
    return rawAchievementsFromIniSections(ini)
  } catch {
    return {}
  }
}
