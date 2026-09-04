/**
 * Update/Validate transfer modal phase helpers (pure, no Electron).
 */

/** Phases for the Update/Validate transfer modal. */
export type UpdateTransferPhase =
  | 'pick_depots'
  | 'running'
  | 'error'
  | 'reapply_ask'
  | 'reapply_pick'
  | 'reapply_run'
  | 'done'

/**
 * After a successful update IPC job, decide the next modal phase.
 * Validate never enters reapply; callers should pass both flags false for validate
 * or skip this helper and go to `done`.
 *
 * @param input - Tool-apply flags snapshotted on the session.
 * @returns `reapply_ask` when either tool was previously applied, else `done`.
 */
export function nextUpdatePhaseAfterSuccess(input: {
  steamlessApplied: boolean
  goldbergApplied: boolean
}): UpdateTransferPhase {
  if (input.steamlessApplied || input.goldbergApplied) return 'reapply_ask'
  return 'done'
}

/**
 * Whether the update modal phase should keep the session in the Transfers dock
 * after `busy` becomes false.
 *
 * @param phase - Current update transfer phase.
 */
export function updatePhaseKeepsDock(phase: UpdateTransferPhase | undefined): boolean {
  if (!phase) return false
  if (phase === 'pick_depots' || phase === 'done') return false
  return true
}
