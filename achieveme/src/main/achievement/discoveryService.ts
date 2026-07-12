import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, SourceId } from '../../shared/types'
import { SOURCE_FILE, getRootsForSource } from './savePathUtils'

export interface DiscoveredApp {
  appid: string
  source: SourceId
  filePath: string
}

function isNumericAppId(name: string): boolean {
  return /^\d+$/.test(name)
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
      all.push(...scanStandardRoot(source, root))
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
