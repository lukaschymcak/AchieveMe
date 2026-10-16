export interface GoldbergReapplySteps {
  skipGenerator: boolean
  generatorArgs: string[]
  copySteamSettings: boolean
  seedAchievements: boolean
}

/**
 * Yes keeps the catalog-based generator path. No skips generation and seeding
 * even when Steam has published achievements.
 *
 * @param includeAchievements - User choice from Reapply Goldberg
 * @param appid - Steam AppID
 * @param schema - Catalog, or null when it was not fetched
 */
export function goldbergReapplySteps(
  includeAchievements: boolean,
  appid: string,
  schema: unknown[] | null
): GoldbergReapplySteps {
  if (!includeAchievements) {
    return {
      skipGenerator: true,
      generatorArgs: ['-skip_ach', appid],
      copySteamSettings: false,
      seedAchievements: false
    }
  }
  const empty = !schema || schema.length === 0
  return {
    skipGenerator: empty,
    generatorArgs: empty ? ['-skip_ach', appid] : ['-acw', appid],
    copySteamSettings: !empty,
    seedAchievements: !empty
  }
}

/**
 * The game page shows Reapply Goldberg for any game with an install folder.
 *
 * @param installPath - `games.install_path`
 */
export function shouldShowReapplyGoldberg(installPath: string | null | undefined): boolean {
  return String(installPath ?? '').trim() !== ''
}

/**
 * Uses a scanned DLL that is on disk. The saved path wins only when it is that file.
 * An empty result means the user has to browse.
 *
 * @param savedPath - `games.goldberg_dll_path`
 * @param scannedPath - Path from `depotScanDll`, if any
 */
export function chooseReapplyDllPath(
  savedPath: string | null | undefined,
  scannedPath: string | null | undefined
): string {
  const scanned = String(scannedPath ?? '').trim()
  if (!scanned) return ''
  const saved = String(savedPath ?? '').trim()
  if (saved && saved.toLowerCase() === scanned.toLowerCase()) return saved
  return scanned
}
