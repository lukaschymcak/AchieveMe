import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '../shared/types'
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from '../shared/appSettingsUtils'

export { DEFAULT_APP_SETTINGS as DEFAULT_SETTINGS, normalizeAppSettings as normalizeSettings }

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const text = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(text) as Partial<AppSettings>
    return normalizeAppSettings(parsed)
  } catch {
    return { ...DEFAULT_APP_SETTINGS, enabledSources: [...DEFAULT_APP_SETTINGS.enabledSources] }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8')
}
