/**
 * Cancel epochs for DepotDownloader jobs.
 * A job snapshots the epoch when it starts. Cancel bumps the epoch so that job
 * becomes stale without poisoning a later job that snapshots again.
 */

const epochs = new Map<string, number>()

/**
 * Epoch captured by a job before it starts work for `channelId`.
 */
export function depotCancelEpoch(channelId: string): number {
  return epochs.get(channelId) ?? 0
}

/**
 * Marks `channelId` canceled. In-flight jobs that snapshotted the previous epoch stop.
 *
 * @returns The new epoch.
 */
export function requestDepotCancel(channelId: string): number {
  const next = depotCancelEpoch(channelId) + 1
  epochs.set(channelId, next)
  return next
}

/**
 * Whether a job that started at `epochAtStart` should abort.
 */
export function isDepotCancelStale(channelId: string, epochAtStart: number): boolean {
  return depotCancelEpoch(channelId) !== epochAtStart
}

/** Clears epochs. Tests only. */
export function resetDepotCancelEpochsForTests(): void {
  epochs.clear()
}
