/**
 * Library retention / processAppId planning helpers (pure, no Electron/SQLite).
 */

/** Whether stored `manifest_gids` JSON contains at least one depot GID. */
export function hasStoredManifestGids(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * True when a library row should survive with no emulator saves
 * (depot install GIDs and/or an install path).
 */
export function shouldRetainWithoutSaves(
  game: { manifest_gids?: string; install_path?: string } | undefined
): boolean {
  if (!game) return false
  if (hasStoredManifestGids(game.manifest_gids)) return true
  return Boolean(game.install_path?.trim())
}

/** True when `appid` is in the ignored set. */
export function isIgnoredAppid(ignored: ReadonlySet<string>, appid: string): boolean {
  return ignored.has(appid)
}

export type ProcessAppIdAction =
  | 'skip-ignored'
  | 'delete-orphan'
  | 'retain-without-saves'
  | 'upsert-from-saves'

/**
 * Decides how `processAppId` should treat a library AppID.
 *
 * @param input - Scan + ignore + existing row context.
 */
export function planProcessAppId(input: {
  appid: string
  ignoredAppids: ReadonlySet<string>
  discoveredCount: number
  existing?: { manifest_gids: string; install_path: string }
}): ProcessAppIdAction {
  if (isIgnoredAppid(input.ignoredAppids, input.appid)) {
    return 'skip-ignored'
  }
  if (input.discoveredCount > 0) {
    return 'upsert-from-saves'
  }
  if (shouldRetainWithoutSaves(input.existing)) {
    return 'retain-without-saves'
  }
  return 'delete-orphan'
}

/**
 * Whether `pruneOrphanedGames` should remove this library row.
 *
 * @param game - Existing game columns used for retention.
 * @param onDisk - True when an emulator save was discovered for this AppID.
 */
export function shouldPruneLibraryGame(
  game: { manifest_gids: string; install_path: string },
  onDisk: boolean
): boolean {
  if (onDisk) return false
  if (shouldRetainWithoutSaves(game)) return false
  return true
}
