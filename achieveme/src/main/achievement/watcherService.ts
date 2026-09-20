import chokidar, { type FSWatcher } from 'chokidar'
import path from 'node:path'
import type { AppSettings } from '../../shared/types'
import { shouldPruneLibraryGame } from '../../shared/libraryRetentionUtils'
import { getDb } from '../db/database'
import { deleteGame, getAllGames, getIgnoredAppids, isAppidIgnored } from '../db/repository'
import { getWatchRoots, scanAllSources } from './discoveryService'
import { processAppId } from './processAppId'
import { regenerateProfileStats } from './profileStatsService'
import { pruneAppImages } from './imageCacheProtocol'
import { getGseSaveFoldersForAppid } from './savePathUtils'
import { syncGseSavesToLudusavi } from './ludusaviCustomGames'
import { resolveLudusaviGuiConfigPath } from './ludusaviConfigPatch'

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
  if (isAppidIgnored(getDb(), appid)) return

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

export function pruneOrphanedGames(settings: AppSettings): void {
  const db = getDb()
  const onDisk = new Set(scanAllSources(settings).map((d) => d.appid))
  let removed = 0

  for (const game of getAllGames(db)) {
    if (
      !shouldPruneLibraryGame(
        {
          manifest_gids: game.manifest_gids ?? '',
          install_path: game.install_path ?? ''
        },
        onDisk.has(game.appid)
      )
    ) {
      continue
    }
    deleteGame(db, game.appid)
    pruneAppImages(game.appid)
    removed++
  }

  if (removed > 0) {
    regenerateProfileStats(db)
  }
}

async function runInitialScan(settings: AppSettings): Promise<void> {
  pruneOrphanedGames(settings)

  const ignored = new Set(getIgnoredAppids(getDb()))
  const discovered = scanAllSources(settings)
  const appids = [...new Set(discovered.map((d) => d.appid))].filter((id) => !ignored.has(id))

  for (const appid of appids) {
    await processAppId(appid, settings)
  }

  // Backfill GSE / Goldberg save folders into Ludusavi GUI config for all active games in library
  try {
    const guiConfigPath = resolveLudusaviGuiConfigPath()
    if (guiConfigPath) {
      const allGames = getAllGames(getDb())
      for (const game of allGames) {
        if (ignored.has(game.appid)) continue
        const title = game.ludusavi_title || game.name
        if (!title) continue
        const gseFolders = getGseSaveFoldersForAppid(game.appid, settings)
        if (gseFolders.length > 0) {
          syncGseSavesToLudusavi(game.appid, title, gseFolders, guiConfigPath)
        }
      }
    }
  } catch {
    // Non-blocking
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

  function handleWatchPath(filePath: string): void {
    for (const { root } of watchRoots) {
      if (filePath.toLowerCase().startsWith(root.toLowerCase())) {
        const appid = extractAppId(filePath, root)
        if (appid) {
          scheduleProcess(appid, settings)
          break
        }
      }
    }
  }

  watcher.on('add', handleWatchPath)
  watcher.on('change', handleWatchPath)
  watcher.on('unlink', handleWatchPath)

  // Process everything already on disk on startup
  await runInitialScan(settings)
}
