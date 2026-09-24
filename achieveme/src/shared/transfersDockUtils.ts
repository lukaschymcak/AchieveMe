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
  /** Whether the row's X can stop real background work (vs just dismissing the row). */
  cancellable: boolean
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

/**
 * Phases where work runs automatically and the user is only waiting.
 * Interactive steps (`depots`, Goldberg setup) and terminal states stay out of
 * the dock — closing the wizard on those clears the session instead.
 */
const DEPOT_DOCK_PHASES: ReadonlySet<DepotPhase> = new Set(['fetching', 'downloading'])

/**
 * Whether a depot session should appear in the Transfers dock.
 * Only automated in-progress work qualifies: manifest fetch and the file download.
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
  // Errors are surfaced inside the modal; closing it dismisses the session.
  if (phase === 'error') return false
  if (phase.startsWith('reapply_')) return true
  if (phase === 'running') return true
  return false
}

/**
 * Builds dock rows from the current App shell sessions.
 *
 * @param input - Active sessions and which transfer modals are already open.
 */
export function buildTransferDockRows(input: {
  depot?: ActiveDepotSession | null
  update?: UpdateDockSession | null
  /** When true, omit the depot row — the wizard is already on screen. */
  depotModalOpen?: boolean
  /** When true, omit the update row — the transfer modal is already on screen. */
  updateModalOpen?: boolean
}): TransferDockRow[] {
  const rows: TransferDockRow[] = []

  if (shouldShowDepotInDock(input.depot ?? null) && !input.depotModalOpen) {
    const depot = input.depot!
    rows.push({
      id: `depot:${depot.channelId}`,
      kind: 'depot',
      title: depot.gameName?.trim() || 'Download',
      pct: Math.max(0, Math.min(100, depot.pct ?? 0)),
      statusLabel: depot.status?.trim() || depot.phase,
      openTarget: 'depot',
      // Only the file download can be stopped through the cancel IPC.
      cancellable: depot.phase === 'downloading'
    })
  }

  if (shouldShowUpdateInDock(input.update ?? null) && !input.updateModalOpen) {
    const update = input.update!
    const modeLabel = update.mode === 'validate' ? 'Validate' : 'Update'
    rows.push({
      id: `update:${update.appid}:${update.mode}`,
      kind: 'update',
      title: update.gameName?.trim() || modeLabel,
      pct: Math.max(0, Math.min(100, update.pct ?? 0)),
      statusLabel: update.label?.trim() || update.error?.trim() || update.phase || modeLabel,
      openTarget: 'update',
      // No cancel IPC exists for updates; dismissing the row only clears the session.
      cancellable: false
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
