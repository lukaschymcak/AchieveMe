/**
 * Pure helpers for the app-shell Transfers dock (which sessions appear, row shape).
 */

import type { ActiveDepotSession, DepotPhase } from './types'

/** What the dock opens when a row is clicked. */
export type TransferOpenTarget = 'depot' | 'update'

/** One row in the Transfers dock list. */
export interface TransferDockRow {
  id: string
  kind: 'depot' | 'update'
  title: string
  pct: number
  statusLabel: string
  openTarget: TransferOpenTarget
}

/**
 * Minimal update/validate session fields the dock needs.
 * Matches the extended `ActiveUpdateSession` shape from Task 3+.
 */
export interface UpdateDockSession {
  appid: string
  mode: 'update' | 'validate'
  busy: boolean
  pct: number
  label: string
  error: string
  gameName?: string
  phase?: string
}

const DEPOT_DOCK_PHASES: ReadonlySet<DepotPhase> = new Set([
  'fetching',
  'depots',
  'downloading',
  'failed',
  'canceled'
])

/**
 * Whether a depot session should appear in the Transfers dock.
 *
 * @param session - Live depot wizard session, or null.
 */
export function shouldShowDepotInDock(session: ActiveDepotSession | null | undefined): boolean {
  if (!session) return false
  return DEPOT_DOCK_PHASES.has(session.phase)
}

/**
 * Whether an update/validate session should appear in the Transfers dock.
 *
 * @param session - Live update session, or null.
 */
export function shouldShowUpdateInDock(session: UpdateDockSession | null | undefined): boolean {
  if (!session) return false
  if (session.busy) return true
  const phase = session.phase
  if (!phase || phase === 'pick_depots' || phase === 'done') return false
  if (phase === 'error') return true
  if (phase.startsWith('reapply_')) return true
  if (phase === 'running') return true
  return false
}

/**
 * Builds dock rows from the current App shell sessions.
 *
 * @param input - Active depot and update sessions.
 */
export function buildTransferDockRows(input: {
  depot?: ActiveDepotSession | null
  update?: UpdateDockSession | null
}): TransferDockRow[] {
  const rows: TransferDockRow[] = []

  if (shouldShowDepotInDock(input.depot ?? null)) {
    const depot = input.depot!
    rows.push({
      id: `depot:${depot.channelId}`,
      kind: 'depot',
      title: depot.gameName?.trim() || 'Download',
      pct: Math.max(0, Math.min(100, depot.pct ?? 0)),
      statusLabel: depot.status?.trim() || depot.phase,
      openTarget: 'depot'
    })
  }

  if (shouldShowUpdateInDock(input.update ?? null)) {
    const update = input.update!
    const modeLabel = update.mode === 'validate' ? 'Validate' : 'Update'
    rows.push({
      id: `update:${update.appid}:${update.mode}`,
      kind: 'update',
      title: update.gameName?.trim() || modeLabel,
      pct: Math.max(0, Math.min(100, update.pct ?? 0)),
      statusLabel: update.label?.trim() || update.error?.trim() || update.phase || modeLabel,
      openTarget: 'update'
    })
  }

  return rows
}

/**
 * Whether the Transfers dock chip should be visible.
 *
 * @param rows - Rows from `buildTransferDockRows`.
 */
export function isTransfersDockVisible(rows: TransferDockRow[]): boolean {
  return rows.length > 0
}
