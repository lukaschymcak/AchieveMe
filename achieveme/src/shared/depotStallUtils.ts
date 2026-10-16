/** Silence before a DepotDownloader run is killed and started again. */
export const DEPOT_STALL_MS = 120_000

/** Extra attempts after the first silent run. */
export const DEPOT_STALL_MAX_RETRIES = 3

/**
 * True when DepotDownloader has produced no output and no byte movement
 * for the stall window.
 *
 * @param nowMs - Current epoch ms
 * @param lastActivityMs - Last stdout line or disk/network byte change
 * @param stallMs - Silence threshold
 */
/**
 * Adds or removes DepotDownloader's checksum flag.
 * Updates skip it; only an explicit validate run includes it.
 *
 * @param args - CLI args without a decision about `-validate`
 * @param validate - When true, checksum files already on disk
 */
export function applyDepotValidateArg(args: readonly string[], validate: boolean): string[] {
  const next = args.filter((arg) => arg !== '-validate')
  if (validate) next.push('-validate')
  return next
}

export function isDepotStalled(
  nowMs: number,
  lastActivityMs: number,
  stallMs: number = DEPOT_STALL_MS
): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastActivityMs)) return false
  return nowMs - lastActivityMs >= stallMs
}
