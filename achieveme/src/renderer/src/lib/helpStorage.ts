import { HELP_STORAGE_KEYS } from './helpContent'

export function shouldShowFirstRun(): boolean {
  return localStorage.getItem(HELP_STORAGE_KEYS.firstRunSeen) !== '1'
}

export function shouldShowLongPressHint(): boolean {
  return localStorage.getItem(HELP_STORAGE_KEYS.longPressHintSeen) !== '1'
}
