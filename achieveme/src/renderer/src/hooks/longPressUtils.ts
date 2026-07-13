export function computeHoldDurationMs(threshold: number, gracePeriod: number): number {
  return Math.max(0, threshold - gracePeriod)
}

export function shouldShowHoldVisuals(
  elapsedMs: number,
  gracePeriod: number,
  released: boolean
): boolean {
  return !released && elapsedMs >= gracePeriod
}

export function shouldFireLongPress(
  elapsedMs: number,
  threshold: number,
  released: boolean
): boolean {
  return !released && elapsedMs >= threshold
}
