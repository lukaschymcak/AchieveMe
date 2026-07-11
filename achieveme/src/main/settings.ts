import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { ALL_SOURCES } from '../shared/types'
import type { AppSettings } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  steamApiKey: '',
  enabledSources: [...ALL_SOURCES],
  customRoots: {}
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const text = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(text) as Partial<AppSettings>
    return {
      steamApiKey: parsed.steamApiKey ?? DEFAULT_SETTINGS.steamApiKey,
      enabledSources: parsed.enabledSources ?? DEFAULT_SETTINGS.enabledSources,
      customRoots: parsed.customRoots ?? DEFAULT_SETTINGS.customRoots
    }
  } catch {
    return { ...DEFAULT_SETTINGS, enabledSources: [...ALL_SOURCES] }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8')
}
