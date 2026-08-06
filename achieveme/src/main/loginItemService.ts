import { app } from 'electron'
import type { AppSettings } from '../shared/types'
import { buildLoginItemOptions } from '../shared/loginItemUtils'

export {
  HIDDEN_LAUNCH_ARG,
  shouldStartHidden,
  buildLoginItemOptions
} from '../shared/loginItemUtils'
export type { LoginItemOptions } from '../shared/loginItemUtils'

/**
 * Syncs OS login-item registration with the given settings.
 *
 * @param settings - Persisted app settings
 */
export const syncLoginItemSettings = (
  settings: Pick<AppSettings, 'openAtLogin' | 'startMinimizedToTray'>
): void => {
  app.setLoginItemSettings(buildLoginItemOptions(settings))
}
