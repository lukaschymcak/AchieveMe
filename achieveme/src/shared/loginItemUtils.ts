import type { AppSettings } from './types'

/** CLI flag registered with the OS login item when start-minimized is enabled. */
export const HIDDEN_LAUNCH_ARG = '--hidden'

export type LoginItemOptions = {
  openAtLogin: boolean
  args: string[]
}

/**
 * Returns true when this process was launched with the hidden-start flag.
 *
 * @param argv - Process argument list (typically `process.argv`)
 */
export const shouldStartHidden = (argv: readonly string[]): boolean =>
  argv.includes(HIDDEN_LAUNCH_ARG)

/**
 * Builds Electron login-item options from app settings.
 * Passes `--hidden` only when both open-at-login and start-minimized are enabled.
 *
 * @param settings - Persisted app settings
 */
export const buildLoginItemOptions = (
  settings: Pick<AppSettings, 'openAtLogin' | 'startMinimizedToTray'>
): LoginItemOptions => {
  const openAtLogin = settings.openAtLogin
  const args =
    openAtLogin && settings.startMinimizedToTray ? [HIDDEN_LAUNCH_ARG] : []
  return { openAtLogin, args }
}
