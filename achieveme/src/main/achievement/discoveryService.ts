import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, SourceId } from '../../shared/types'

export interface DiscoveredApp {
  appid: string
  source: SourceId
  filePath: string
}

function expandEnv(value: string): string {
  return value.replace(/%([^%]+)%/g, (_, key: string) => process.env[key] ?? '')
}

function isNumericAppId(name: string): boolean {
  return /^\d+$/.test(name)
}

// Default save folder root paths per emulator (Windows env vars expanded at runtime)
const DEFAULT_ROOTS: Record<SourceId, string[]> = {
  goldberg: [expandEnv('%APPDATA%\\Goldberg SteamEmu Saves')],
  gse: [expandEnv('%APPDATA%\\GSE Saves')],
  empress: [expandEnv('%APPDATA%\\EMPRESS'), expandEnv('%PUBLIC%\\Documents\\EMPRESS')],
  codex: [expandEnv('%PUBLIC%\\Documents\\Steam\\CODEX')],
  rune: [expandEnv('%PUBLIC%\\Documents\\Steam\\RUNE')],
  onlinefix: [expandEnv('%PUBLIC%\\Documents\\OnlineFix')],
  smartsteamemu: [expandEnv('%APPDATA%\\SmartSteamEmu')],
  skidrow: [expandEnv('%LOCALAPPDATA%\\SKIDROW')],
  darksiders: [path.join(expandEnv('%USERPROFILE%'), 'Documents', 'DARKSiDERS')],
  ali213: [path.join(expandEnv('%USERPROFILE%'), 'Documents', 'VALVE')],
  hoodlum: [], // no default root; user must add one in settings
  creamapi: [expandEnv('%APPDATA%\\CreamAPI')],
  reloaded: [expandEnv('%PROGRAMDATA%\\Steam')]
}

// The achievement file name each emulator writes inside the appid folder
const SOURCE_FILE: Record<SourceId, string> = {
  goldberg: 'achievements.json',
  gse: 'achievements.json',
  empress: 'achievements.json', // but path is nested — see scanEmpressRoot
  codex: 'achievements.ini',
  rune: 'achievements.ini',
  onlinefix: 'achievements.ini',
  smartsteamemu: 'stats.bin',
  skidrow: 'achiev.ini',
  darksiders: 'achiev.ini',
  ali213: 'Achievements.Bin', // despite extension, it is an INI file
  hoodlum: 'hlm.ini',
  creamapi: 'CreamAPI.Achievements.cfg',
  reloaded: 'achievements.ini'
}

function getRootsForSource(source: SourceId, settings: AppSettings): string[] {
  const defaults = DEFAULT_ROOTS[source] ?? []
  const custom = settings.customRoots[source] ?? []
  return [...defaults, ...custom]
}

// Empress saves at: {root}/{appid}/remote/{appid}/achievements.json
function scanEmpressRoot(root: string): DiscoveredApp[] {
  const results: DiscoveredApp[] = []
  if (!fs.existsSync(root)) return results

  let entries: string[] = []
  try {
    entries = fs.readdirSync(root)
  } catch {
    return results
  }

  for (const name of entries) {
    if (!isNumericAppId(name)) continue
    const filePath = path.join(root, name, 'remote', name, 'achievements.json')
    if (!fs.existsSync(filePath)) continue
    results.push({ appid: name, source: 'empress', filePath })
  }

  return results
}

function scanStandardRoot(source: SourceId, root: string): DiscoveredApp[] {
  const results: DiscoveredApp[] = []
  if (!fs.existsSync(root)) return results

  const fileName = SOURCE_FILE[source]
  let subdirs: string[] = []
  try {
    subdirs = fs.readdirSync(root)
  } catch {
    return results
  }

  for (const name of subdirs) {
    if (!isNumericAppId(name)) continue
    const filePath = path.join(root, name, fileName)
    if (!fs.existsSync(filePath)) continue
    results.push({ appid: name, source, filePath })
  }

  return results
}

export function scanAllSources(settings: AppSettings): DiscoveredApp[] {
  const all: DiscoveredApp[] = []

  for (const source of settings.enabledSources) {
    const roots = getRootsForSource(source, settings)

    for (const root of roots) {
      if (source === 'empress') {
        all.push(...scanEmpressRoot(root))
      } else {
        all.push(...scanStandardRoot(source, root))
      }
    }
  }

  // Deduplicate by appid + source + filePath
  const seen = new Set<string>()
  const unique: DiscoveredApp[] = []
  for (const entry of all) {
    const key = `${entry.appid}|${entry.source}|${entry.filePath.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
  }

  return unique
}

// Returns every watch root that exists on disk.
// Used by the watcher service to know what folders to watch.
export function getWatchRoots(settings: AppSettings): Array<{ source: SourceId; root: string }> {
  const result: Array<{ source: SourceId; root: string }> = []

  for (const source of settings.enabledSources) {
    const roots = getRootsForSource(source, settings)
    for (const root of roots) {
      if (fs.existsSync(root)) {
        result.push({ source, root })
      }
    }
  }

  return result
}
