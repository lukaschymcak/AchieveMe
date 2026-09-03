export type LudusaviGameDecision = 'Processed' | 'Ignored' | 'Cancelled' | string

/**
 * Parses Ludusavi `--api` stdout JSON.
 *
 * @param raw - Raw stdout (may be blank on error).
 * @returns Parsed value, or null when empty/invalid.
 */
export function parseLudusaviApiJson(raw: string): unknown {
  const text = String(raw || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * Extracts the resolved title from a `ludusavi find --api` payload.
 * Game keys under `games` are the matched titles.
 *
 * @param apiJson - Parsed `--api` JSON.
 */
export function extractFindTitle(apiJson: unknown): string | null {
  if (!apiJson || typeof apiJson !== 'object') return null
  const games = (apiJson as { games?: unknown }).games
  if (!games || typeof games !== 'object' || Array.isArray(games)) return null
  const keys = Object.keys(games as Record<string, unknown>)
  const first = keys[0]?.trim()
  return first || null
}

export interface LudusaviBackupGameResult {
  ok: boolean
  decision?: string
  bytes?: number
  error?: string
}

function sumFileBytes(files: unknown): number {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return 0
  let total = 0
  for (const entry of Object.values(files as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const bytes = (entry as { bytes?: unknown }).bytes
    if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0) {
      total += bytes
    }
  }
  return total
}

function firstFileError(files: unknown): string | null {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return null
  for (const entry of Object.values(files as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as { failed?: unknown; error?: { message?: string } }
    if (row.failed === true) {
      const msg = row.error?.message?.trim()
      return msg || 'One or more save files failed to back up.'
    }
  }
  return null
}

/**
 * Reads backup outcome for one title from a `ludusavi backup --api` payload.
 *
 * @param apiJson - Parsed `--api` JSON.
 * @param title - Exact Ludusavi game title key.
 */
export function extractBackupGameResult(
  apiJson: unknown,
  title: string
): LudusaviBackupGameResult {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }
  if (!apiJson || typeof apiJson !== 'object') {
    return { ok: false, error: 'Invalid Ludusavi API response.' }
  }

  const root = apiJson as {
    errors?: { someGamesFailed?: boolean; unknownGames?: string[] }
    games?: Record<string, unknown>
  }
  const gameEntry = root.games?.[cleanTitle]
  if (!gameEntry || typeof gameEntry !== 'object') {
    const unknown = root.errors?.unknownGames
    if (Array.isArray(unknown) && unknown.includes(cleanTitle)) {
      return { ok: false, error: 'Game not found in Ludusavi manifest.' }
    }
    return { ok: false, error: 'Game not found in Ludusavi backup result.' }
  }

  const decision = String((gameEntry as { decision?: unknown }).decision ?? '').trim()
  const files = (gameEntry as { files?: unknown }).files
  const fileError = firstFileError(files)
  if (fileError) {
    return { ok: false, decision: decision || undefined, error: fileError, bytes: sumFileBytes(files) }
  }

  if (decision === 'Processed') {
    return { ok: true, decision, bytes: sumFileBytes(files) }
  }

  if (decision === 'Ignored' || decision === 'Cancelled') {
    return {
      ok: false,
      decision,
      error: root.errors?.someGamesFailed
        ? `Backup ${decision.toLowerCase()}.`
        : `Backup ${decision.toLowerCase()}.`,
      bytes: sumFileBytes(files)
    }
  }

  if (!decision) {
    return { ok: false, error: 'Ludusavi did not report a backup decision.' }
  }

  return { ok: false, decision, error: `Unexpected backup decision: ${decision}.` }
}

/**
 * Alias for backup/restore `--api` game-entry parsing (same schema).
 *
 * @param apiJson - Parsed `--api` JSON.
 * @param title - Exact Ludusavi game title key.
 */
export const extractOperationGameResult = extractBackupGameResult

export interface LudusaviSnapshot {
  /** Ludusavi backup `name` / id for `--backup`. */
  id: string
  /** Raw `when` string from the API. */
  when: string
  /** Parsed epoch ms for sorting; 0 if unparsable. */
  whenMs: number
}

/**
 * Returns true when a Ludusavi backup id is safe to pass on the CLI.
 *
 * @param id - Candidate backup name from `backups --api`.
 */
export function isSafeLudusaviBackupId(id: string): boolean {
  const clean = String(id || '').trim()
  if (!clean || clean.length > 200) return false
  if (/[\\/\0\r\n]/.test(clean)) return false
  if (clean.includes('..')) return false
  return true
}

function parseWhenMs(when: unknown): number {
  if (typeof when !== 'string' || !when.trim()) return 0
  const ms = Date.parse(when)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Extracts snapshot rows from a `ludusavi backups --api` payload for one title.
 *
 * @param apiJson - Parsed `--api` JSON.
 * @param title - Exact Ludusavi game title key.
 */
export function extractBackupSnapshots(apiJson: unknown, title: string): LudusaviSnapshot[] {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle || !apiJson || typeof apiJson !== 'object') return []
  const games = (apiJson as { games?: Record<string, unknown> }).games
  if (!games || typeof games !== 'object' || Array.isArray(games)) return []
  const entry = games[cleanTitle]
  if (!entry || typeof entry !== 'object') return []
  const backups = (entry as { backups?: unknown }).backups
  if (!Array.isArray(backups)) return []

  const out: LudusaviSnapshot[] = []
  for (const row of backups) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as { name?: unknown }).name ?? '').trim()
    if (!isSafeLudusaviBackupId(id)) continue
    const when = String((row as { when?: unknown }).when ?? '').trim()
    out.push({ id, when, whenMs: parseWhenMs(when) })
  }
  return out
}

/**
 * Sorts snapshots newest first (stable for equal whenMs by id).
 *
 * @param snapshots - Snapshot list.
 */
export function sortSnapshotsNewestFirst(snapshots: LudusaviSnapshot[]): LudusaviSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (b.whenMs !== a.whenMs) return b.whenMs - a.whenMs
    return String(b.id).localeCompare(String(a.id))
  })
}

/**
 * Returns the newest `limit` snapshots after sorting.
 *
 * @param snapshots - Snapshot list.
 * @param limit - Max count (clamped to >= 0).
 */
export function takeNewestSnapshots(
  snapshots: LudusaviSnapshot[],
  limit: number
): LudusaviSnapshot[] {
  const n = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  return sortSnapshotsNewestFirst(snapshots).slice(0, n)
}

/**
 * Formats a unix backup timestamp as a short relative label.
 *
 * @param unixSeconds - Backup time, or 0 when never.
 * @param nowSeconds - Reference "now".
 */
export function formatBackupRelativeTime(unixSeconds: number, nowSeconds: number): string {
  if (!unixSeconds || unixSeconds <= 0) return ''
  const delta = Math.max(0, Math.floor(nowSeconds) - Math.floor(unixSeconds))
  if (delta < 60) return 'just now'
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}
