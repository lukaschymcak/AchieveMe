import chokidar, { type FSWatcher } from 'chokidar'
import path from 'node:path'
import type { AppSettings } from '../../shared/types'
import { getWatchRoots } from './discoveryService'
import { processAppId } from './processAppId'

let watcher: FSWatcher | null = null
const debounceTimers = new Map<string, NodeJS.Timeout>()
const DEBOUNCE_MS = 600

// Extract the appid from a file path given the known watch root.
// e.g. root="C:\GSE Saves", filePath="C:\GSE Saves\1234567\achievements.json" → "1234567"
function extractAppId(filePath: string, root: string): string | null {
  const rel = path.relative(root, filePath)
  const parts = rel.split(path.sep)
  if (parts.length >= 1 && /^\d+$/.test(parts[0])) {
    return parts[0]
  }
  return null
}

function scheduleProcess(appid: string, settings: AppSettings): void {
  const existing = debounceTimers.get(appid)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    debounceTimers.delete(appid)
    processAppId(appid, settings).catch(() => {
      // processAppId failing for one game should not crash the watcher
    })
  }, DEBOUNCE_MS)

  debounceTimers.set(appid, timer)
}

async function runInitialScan(settings: AppSettings): Promise<void> {
  const { scanAllSources } = await import('./discoveryService')
  const discovered = scanAllSources(settings)
  const appids = [...new Set(discovered.map((d) => d.appid))]

  for (const appid of appids) {
    await processAppId(appid, settings)
  }
}

export async function startWatcher(settings: AppSettings): Promise<void> {
  if (watcher) {
    await watcher.close()
    watcher = null
  }

  const watchRoots = getWatchRoots(settings)
  if (watchRoots.length === 0) {
    // No roots exist yet — skip watching but still do the initial scan
    await runInitialScan(settings)
    return
  }

  const rootPaths = watchRoots.map((r) => r.root)

  watcher = chokidar.watch(rootPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 4
  })

  watcher.on('change', (filePath: string) => {
    for (const { root } of watchRoots) {
      if (filePath.toLowerCase().startsWith(root.toLowerCase())) {
        const appid = extractAppId(filePath, root)
        if (appid) {
          scheduleProcess(appid, settings)
          break
        }
      }
    }
  })

  // Process everything already on disk on startup
  await runInitialScan(settings)
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close()
    watcher = null
  }
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer)
  }
  debounceTimers.clear()
}
