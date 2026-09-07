import type { AppSettings } from './types'

/** CLI flag registered with the OS login item when start-minimized is enabled. */
export const HIDDEN_LAUNCH_ARG = '--hidden'

export type LoginItemOptions = {
  openAtLogin: boolean
  args: string[]
}

/** Packaged vs portable flags used to gate OS login-item registration. */
export type LoginItemRuntime = {
  readonly isPackaged: boolean
  readonly isPortable: boolean
}

/**
 * Returns true when this process was launched with the hidden-start flag.
 *
 * @param argv - Process argument list (typically `process.argv`)
 */
export const shouldStartHidden = (argv: readonly string[]): boolean =>
  argv.includes(HIDDEN_LAUNCH_ARG)

/**
 * Returns true when electron-builder portable sets `PORTABLE_EXECUTABLE_DIR`.
 *
 * @param env - Environment map (typically `process.env`)
 */
export const isPortableFromEnv = (env: NodeJS.Dict<string>): boolean =>
  Boolean(env.PORTABLE_EXECUTABLE_DIR?.trim())

/**
 * Returns true when OS login-item registration is supported (installed Setup only).
 *
 * @param runtime - Packaged and portable flags
 */
export const loginItemsSupported = (runtime: LoginItemRuntime): boolean =>
  runtime.isPackaged && !runtime.isPortable

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

/**
 * Resolves login-item options for the current runtime.
 * Portable and unpackaged builds always clear the OS login item.
 *
 * @param settings - Persisted app settings
 * @param runtime - Packaged and portable flags
 */
export const resolveLoginItemOptions = (
  settings: Pick<AppSettings, 'openAtLogin' | 'startMinimizedToTray'>,
  runtime: LoginItemRuntime
): LoginItemOptions =>
  loginItemsSupported(runtime)
    ? buildLoginItemOptions(settings)
    : { openAtLogin: false, args: [] }
