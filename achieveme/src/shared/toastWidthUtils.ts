/**
 * Toast overlay size helpers (main + renderer).
 * Hydra choreography expands the panel to a measured content width.
 */

/** Fixed overlay height in CSS pixels. */
export const TOAST_HEIGHT = 180

/** Horizontal `#root` padding (20px each side) — keep in sync with toast.css `#root`. */
export const TOAST_ROOT_PAD_X = 40

/** Narrowest expanded panel (icon + short copy). */
export const TOAST_PANEL_MIN = 280

/** Widest expanded panel — long description cap. */
export const TOAST_PANEL_MAX = 640

/** Narrowest overlay window (panel min + root pad). */
export const TOAST_MIN_WIDTH = TOAST_PANEL_MIN + TOAST_ROOT_PAD_X

/** Widest overlay window (panel max + root pad) — also measure headroom. */
export const TOAST_MAX_WIDTH = TOAST_PANEL_MAX + TOAST_ROOT_PAD_X

/**
 * Clamps a measured panel width into the allowed expand range.
 *
 * @param width - Measured CSS pixel panel width (may be non-finite).
 */
export function clampToastPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return TOAST_PANEL_MIN
  return Math.min(TOAST_PANEL_MAX, Math.max(TOAST_PANEL_MIN, Math.ceil(width)))
}

/**
 * Clamps a window width into the allowed overlay range.
 *
 * @param width - Requested CSS pixel window width (may be non-finite).
 */
export function clampToastWindowWidth(width: number): number {
  if (!Number.isFinite(width)) return TOAST_MIN_WIDTH
  return Math.min(TOAST_MAX_WIDTH, Math.max(TOAST_MIN_WIDTH, Math.ceil(width)))
}

/**
 * Converts a measured card/panel width into a window width (adds root pad, then clamps).
 *
 * @param cardWidth - `getBoundingClientRect().width` of the toast card in measure mode.
 */
export function toastWindowWidthFromCard(cardWidth: number): number {
  return clampToastWindowWidth(cardWidth + TOAST_ROOT_PAD_X)
}
