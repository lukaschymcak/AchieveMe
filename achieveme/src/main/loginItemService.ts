import { app } from 'electron'
import type { AppSettings } from '../shared/types'
import {
  isPortableFromEnv,
  resolveLoginItemOptions,
  type LoginItemRuntime
} from '../shared/loginItemUtils'

export {
  HIDDEN_LAUNCH_ARG,
  shouldStartHidden,
  buildLoginItemOptions,
  isPortableFromEnv,
  loginItemsSupported,
  resolveLoginItemOptions
} from '../shared/loginItemUtils'
export type { LoginItemOptions, LoginItemRuntime } from '../shared/loginItemUtils'

/**
 * Detects whether this process is packaged and/or a portable build.
 */
export const detectAppRuntime = (): LoginItemRuntime => ({
  isPackaged: app.isPackaged,
  isPortable: isPortableFromEnv(process.env)
})

/**
 * Syncs OS login-item registration with the given settings.
 * Portable and unpackaged builds clear any Electron-owned login item.
 *
 * @param settings - Persisted app settings
 */
export const syncLoginItemSettings = (
  settings: Pick<AppSettings, 'openAtLogin' | 'startMinimizedToTray'>
): void => {
  app.setLoginItemSettings(resolveLoginItemOptions(settings, detectAppRuntime()))
}
