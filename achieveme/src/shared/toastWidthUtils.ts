/**
 * Toast overlay width clamp helpers (main + renderer).
 */

/** Fixed toast window height in CSS pixels. */
export const TOAST_HEIGHT = 120

/** Narrowest overlay after content measure (icon phase + short copy). */
export const TOAST_MIN_WIDTH = 360

/** Widest overlay — measure headroom and long-description cap. */
export const TOAST_MAX_WIDTH = 680

/** Horizontal `#root` padding (6px each side) included when sizing the window. */
export const TOAST_ROOT_PAD_X = 12

/**
 * Clamps a measured toast width into the allowed window range.
 *
 * @param width - Measured CSS pixel width (may be non-finite).
 * @returns Integer width between {@link TOAST_MIN_WIDTH} and {@link TOAST_MAX_WIDTH}.
 */
export function clampToastWindowWidth(width: number): number {
  if (!Number.isFinite(width)) return TOAST_MIN_WIDTH
  return Math.min(TOAST_MAX_WIDTH, Math.max(TOAST_MIN_WIDTH, Math.ceil(width)))
}

/**
 * Converts a measured card width into a window width (adds root pad, then clamps).
 *
 * @param cardWidth - `getBoundingClientRect().width` of the toast card in measure mode.
 */
export function toastWindowWidthFromCard(cardWidth: number): number {
  return clampToastWindowWidth(cardWidth + TOAST_ROOT_PAD_X)
}
