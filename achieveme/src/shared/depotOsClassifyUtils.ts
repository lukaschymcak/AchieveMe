export type DepotOsClass = 'drop' | 'auto-keep' | 'unsure'

const DROP_RE = /\b(linux|macos|osx|mac)\b/i
const WINDOWS_RE = /\b(windows|win32|win64)\b/i
const DLC_RE = /\bdlc\b/i

/**
 * Classifies a Hubcap depot description for scan auto-import.
 *
 * @param description - Hubcap depot description text.
 * @returns `drop` for non-Windows OS signals, `auto-keep` for Windows/DLC, else `unsure`.
 */
export function classifyDepotDescription(description: string): DepotOsClass {
  const text = String(description || '').trim()
  if (!text) return 'unsure'
  if (DROP_RE.test(text)) return 'drop'
  if (WINDOWS_RE.test(text) || DLC_RE.test(text)) return 'auto-keep'
  return 'unsure'
}

/**
 * Classifies one depot; DLC AppID membership forces auto-keep when not dropped.
 *
 * @param depotId - Hubcap depot id.
 * @param description - Hubcap depot description text.
 * @param dlcIds - Set of DLC app ids from the Hubcap ZIP.
 * @returns Classification for scan auto-import.
 */
export function classifyDepotForScan(
  depotId: string,
  description: string,
  dlcIds: ReadonlySet<string>
): DepotOsClass {
  const base = classifyDepotDescription(description)
  if (base === 'drop') return 'drop'
  if (dlcIds.has(String(depotId || '').trim())) return 'auto-keep'
  return base
}

/** Buckets of depot ids for scan Add selected. */
export interface ScanDepotBuckets {
  autoKeepIds: string[]
  unsureIds: string[]
  dropIds: string[]
}

/**
 * Buckets depots that have non-empty manifest GIDs.
 *
 * @param depots - Depot id → metadata from Hubcap ZIP.
 * @param manifests - Depot id → manifest GID map.
 * @param dlcs - Optional DLC app id → name map from Hubcap ZIP.
 * @returns Sorted-ready id lists per classification bucket.
 */
export function bucketDepotsForScan(
  depots: Record<string, { description: string }>,
  manifests: Record<string, string>,
  dlcs: Record<string, string> = {}
): ScanDepotBuckets {
  const dlcIds = new Set(Object.keys(dlcs || {}))
  const autoKeepIds: string[] = []
  const unsureIds: string[] = []
  const dropIds: string[] = []

  for (const [id, depot] of Object.entries(depots || {})) {
    const gid = manifests[id]
    if (typeof gid !== 'string' || !gid.trim()) continue
    const cls = classifyDepotForScan(id, depot?.description ?? '', dlcIds)
    if (cls === 'drop') dropIds.push(id)
    else if (cls === 'auto-keep') autoKeepIds.push(id)
    else unsureIds.push(id)
  }

  return { autoKeepIds, unsureIds, dropIds }
}

/** Chip label for scan depot picker rows. */
export type DepotScanChip = 'Windows' | 'DLC' | 'Unsure'

/**
 * Picker chip for a depot that is not dropped.
 *
 * @param depotId - Hubcap depot id.
 * @param description - Hubcap depot description text.
 * @param dlcIds - Set of DLC app ids from the Hubcap ZIP.
 * @returns Chip text, or null when the depot is dropped.
 */
export function depotScanChipLabel(
  depotId: string,
  description: string,
  dlcIds: ReadonlySet<string>
): DepotScanChip | null {
  const cls = classifyDepotForScan(depotId, description, dlcIds)
  if (cls === 'drop') return null
  if (cls === 'unsure') return 'Unsure'
  const text = String(description || '')
  if (DLC_RE.test(text) || dlcIds.has(String(depotId || '').trim())) return 'DLC'
  return 'Windows'
}

