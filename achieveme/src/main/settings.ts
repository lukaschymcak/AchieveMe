import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { ALL_SOURCES } from '../shared/types'
import type { AppSettings } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  steamApiKey: '',
  enabledSources: [...ALL_SOURCES],
  customWatchFolders: []
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const text = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(text) as Partial<AppSettings>
    const enabledSources = (parsed.enabledSources ?? DEFAULT_SETTINGS.enabledSources).filter((s) =>
      ALL_SOURCES.includes(s)
    )
    return {
      steamApiKey: parsed.steamApiKey ?? DEFAULT_SETTINGS.steamApiKey,
      enabledSources: enabledSources.length > 0 ? enabledSources : [...ALL_SOURCES],
      customWatchFolders: parsed.customWatchFolders ?? DEFAULT_SETTINGS.customWatchFolders
    }
  } catch {
    return { ...DEFAULT_SETTINGS, enabledSources: [...ALL_SOURCES] }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8')
}
