import type { ManifestCheckResult, UpdateStatus } from './types'

/**
 * Parses a stored `manifest_gids` JSON column into a depot → GID map.
 *
 * @param raw - JSON string from SQLite, or empty.
 * @returns Parsed map, or `{}` when invalid/empty.
 */
export function parseManifestGidsJson(raw: string | null | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        out[key] = value.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Picks manifest GIDs for the depots the user selected.
 *
 * @param manifests - Full depot → GID map from a Hubcap ZIP.
 * @param selectedDepots - Depot IDs the user chose to download/update.
 * @returns Map containing only selected depots that have a non-empty GID.
 */
export function pickManifestGids(
  manifests: Record<string, string>,
  selectedDepots: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of selectedDepots) {
    const gid = manifests[id]
    if (typeof gid === 'string' && gid.trim()) out[id] = gid.trim()
  }
  return out
}

/**
 * Compares stored depot GIDs against live Steam PICS rows.
 *
 * @param storedGids - Baseline depot → GID map.
 * @param liveRows - Live PICS depot rows for the same app.
 * @returns Update status for persistence/UI.
 */
export function resolveUpdateStatus(
  storedGids: Record<string, string>,
  liveRows: ManifestCheckResult[]
): UpdateStatus {
  if (!liveRows.length) return ''

  let comparedAnyDepot = false
  for (const row of liveRows) {
    const saved = storedGids[row.depotId]
    if (!saved) continue
    comparedAnyDepot = true
    if (saved !== row.manifestGid) return 'update_available'
  }

  if (!comparedAnyDepot) return ''
  return 'up_to_date'
}

/**
 * Picks a preferred build ID from live PICS rows.
 *
 * @param liveRows - Live PICS depot rows.
 * @returns First usable build ID, or undefined.
 */
export function resolvePreferredBuildId(liveRows: ManifestCheckResult[]): string | undefined {
  for (const row of liveRows) {
    const buildId = String(row.buildId || '').trim()
    if (/^\d+$/.test(buildId) && Number.parseInt(buildId, 10) > 1) {
      return buildId
    }
  }
  return undefined
}
