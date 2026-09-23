/**
 * Orchestrates boot prune + network warm so the splash exits with data ready.
 */

import path from 'node:path'
import type Database from 'better-sqlite3'
import {
  BOOT_WARM_CONCURRENCY,
  rawFromPersistedAchievements,
  runBootWarmCore,
  type BootWarmCoreDeps,
  type BootWarmProgressListener
} from '../../shared/bootWarmUtils.ts'
import type { BootWarmResult } from '../../shared/types.ts'
import { iconFilenameFromSteamValue } from '../../shared/imageCacheUrls.ts'
import {
  getSteamLibraryHeroUrl,
  normalizeSteamIconUrl
} from '../../shared/steamUrls.ts'
import fs from 'node:fs'
import {
  getAchievementsForGame,
  getAllGameAppids,
  getGame,
  listWantedGames,
  replaceAchievementsForGame,
  upsertGame
} from '../db/repository.ts'
import { loadSettings } from '../settings.ts'
import { pruneObsoleteAppData } from './appDataPruneService.ts'
import { getGameHunterStats } from './gameHunterStatsService.ts'
import {
  getDefaultImageCacheDeps,
  getImagesCacheRoot
} from './imageCacheProtocol.ts'
import {
  coverFilePath,
  ensureCoverCached,
  prefetchGameImages,
  type PrefetchIconSpec
} from './imageCacheService.ts'
import { regenerateProfileStats } from './profileStatsService.ts'
import { enrichApp, getStoreCoverUrl } from './steamApiClient.ts'
import { getNews } from './steamNewsService.ts'

export type { BootWarmProgressListener }
export { rawFromPersistedAchievements }

/**
 * Warms covers for all wanted games if not already on disk.
 */
export async function warmWantedCovers(db: Database.Database): Promise<void> {
  const wanted = listWantedGames(db)
  const deps = getDefaultImageCacheDeps()
  await Promise.allSettled(
    wanted.map(async (w) => {
      const dest = coverFilePath(deps.cacheRoot, w.appid)
      if (fs.existsSync(dest)) return
      const remote =
        w.coverUrl ||
        (await getStoreCoverUrl(db, w.appid, false)) ||
        `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${w.appid}/header.jpg`
      await ensureCoverCached(deps, w.appid, remote)
    })
  )
}

/**
 * Warms one library game: schema/covers if stale, rarities always, images, hunter.
 */
export async function warmLibraryGame(
  db: Database.Database,
  appid: string,
  apiKey: string
): Promise<void> {
  const previous = getAchievementsForGame(db, appid)
  const mergedRaw = rawFromPersistedAchievements(previous)
  const gameRecord = getGame(db, appid)
  const dllDir = gameRecord?.goldberg_dll_path
    ? path.dirname(gameRecord.goldberg_dll_path)
    : undefined
  const enriched = await enrichApp(appid, apiKey, mergedRaw, db, false, dllDir)
  upsertGame(db, enriched.game)
  replaceAchievementsForGame(db, appid, enriched.achievements)

  const coverRemoteUrl = await getStoreCoverUrl(db, appid, false)
  const icons: PrefetchIconSpec[] = []
  for (const ach of enriched.achievements) {
    for (const value of [ach.icon_url, ach.icon_gray_url]) {
      if (!value) continue
      const filename = iconFilenameFromSteamValue(value)
      const remoteUrl = normalizeSteamIconUrl(appid, value)
      if (!filename || !remoteUrl) continue
      const localPath = enriched.localIconSources?.get(filename)
      icons.push(localPath ? { filename, remoteUrl, localPath } : { filename, remoteUrl })
    }
  }

  await prefetchGameImages(getDefaultImageCacheDeps(), appid, {
    coverRemoteUrl,
    heroRemoteUrl: getSteamLibraryHeroUrl(appid),
    icons,
    forceRefresh: false
  })

  await getGameHunterStats(db, appid, undefined, { forceRefresh: true })
}

function buildDefaultCoreDeps(db: Database.Database): BootWarmCoreDeps {
  return {
    prune: () => {
      pruneObsoleteAppData(db, getImagesCacheRoot())
    },
    listAppids: () => getAllGameAppids(db),
    getApiKey: () => loadSettings().steamApiKey ?? '',
    warmGame: (appid, apiKey) => warmLibraryGame(db, appid, apiKey),
    warmNews: async () => {
      await getNews(db, true)
    },
    regenerateProfile: () => {
      regenerateProfileStats(db)
    },
    concurrency: BOOT_WARM_CONCURRENCY
  }
}

/**
 * Runs prune → library warm → news forceRefresh with real AppData deps.
 */
export async function runBootWarm(
  db: Database.Database,
  onProgress?: BootWarmProgressListener,
  depsPartial?: Partial<BootWarmCoreDeps>
): Promise<BootWarmResult> {
  const deps: BootWarmCoreDeps = { ...buildDefaultCoreDeps(db), ...depsPartial }
  const result = await runBootWarmCore(onProgress, deps)
  await warmWantedCovers(db).catch(() => {})
  return result
}

let inflight: Promise<BootWarmResult> | null = null

/**
 * Coalesces concurrent boot warm requests into one run.
 */
export function startBootWarm(
  db: Database.Database,
  onProgress?: BootWarmProgressListener,
  depsPartial?: Partial<BootWarmCoreDeps>
): Promise<BootWarmResult> {
  if (inflight) return inflight
  inflight = runBootWarm(db, onProgress, depsPartial)
    .catch((err: unknown): BootWarmResult => ({
      ok: false,
      gamesWarmed: 0,
      gamesFailed: 0,
      errorMessage: err instanceof Error ? err.message : String(err)
    }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Test helper — clears coalesce lock. */
export function resetBootWarmInflightForTest(): void {
  inflight = null
}
