import path from 'node:path'
import { getDb } from '../db/database'
import {
  upsertGame,
  replaceAchievementsForGame,
  upsertSaveLocation,
  deleteSaveLocationsForApp,
  deleteGame,
  getAchievementsForGame,
  getGame,
  getIgnoredAppids
} from '../db/repository'
import { scanAllSources } from './discoveryService'
import { parseAchievementsBySource } from './parsers/parseBySource'
import { mergeRawAchievements } from './rawMerge'
import { enrichApp, getStoreCoverUrl } from './steamApiClient'
import { regenerateProfileStats } from './profileStatsService'
import {
  encodePortablePath,
  GOLDBERG_JSON_SOURCES,
  getGseSaveFoldersForAppid
} from './savePathUtils'
import { syncGseSavesToLudusavi } from './ludusaviCustomGames'
import { resolveLudusaviGuiConfigPath } from './ludusaviConfigPatch'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { diffAchievements } from './achievementDiff'
import { notifyPlatinumUnlock, notifyUnlocks } from './unlockNotifyService'
import { isNewPlatinum } from '../../shared/unlockToastUtils'
import { getSteamLibraryHeroUrl, normalizeSteamIconUrl } from '../../shared/steamUrls'
import { iconFilenameFromSteamValue } from '../../shared/imageCacheUrls'
import { prefetchGameImages, type PrefetchIconSpec } from './imageCacheService'
import { getDefaultImageCacheDeps, pruneAppImages } from './imageCacheProtocol'
import { planProcessAppId } from '../../shared/libraryRetentionUtils'
import type { AppSettings } from '../../shared/types'

export async function processAppId(
  appid: string,
  settings: AppSettings,
  forceRefresh = false,
  suppressNotifications = false,
  dllDir?: string
): Promise<void> {
  const db = getDb()
  const previousAchievements = getAchievementsForGame(db, appid)
  const previousGame = getGame(db, appid)
  const hadPriorRows = previousAchievements.length > 0

  // 1. Find all save files on disk for this appid
  const allDiscovered = scanAllSources(settings)
  const forThisApp = allDiscovered.filter((d) => d.appid === appid)

  const action = planProcessAppId({
    appid,
    ignoredAppids: new Set(getIgnoredAppids(db)),
    discoveredCount: forThisApp.length,
    existing: previousGame
      ? {
          manifest_gids: previousGame.manifest_gids ?? '',
          install_path: previousGame.install_path ?? ''
        }
      : undefined
  })

  if (action === 'skip-ignored' || action === 'retain-without-saves') {
    return
  }

  if (action === 'delete-orphan') {
    deleteGame(db, appid)
    pruneAppImages(appid)
    regenerateProfileStats(db)
    notifyLibraryUpdated(appid)
    return
  }

  deleteSaveLocationsForApp(db, appid)

  const now = Math.floor(Date.now() / 1000)
  for (const d of forThisApp) {
    if (!GOLDBERG_JSON_SOURCES.includes(d.source)) continue
    const hint = encodePortablePath(d.filePath, d.source, settings)
    upsertSaveLocation(db, {
      appid: d.appid,
      source: d.source,
      file_path: d.filePath,
      root_kind: hint.rootKind,
      root_source: hint.rootSource,
      custom_root: hint.customRoot,
      relative_path: hint.relativePath,
      updated_at: now
    })
  }

  // 2. Parse each save file
  const parsedRows = forThisApp.map((d) => ({
    source: d.source,
    raw: parseAchievementsBySource(d.source, d.filePath)
  }))

  // 3. Merge across sources
  const mergedRaw = mergeRawAchievements(parsedRows)

  // 4. Enrich with Steam API data (schema, global %, app name)
  const resolvedDllDir =
    dllDir ??
    (previousGame?.goldberg_dll_path
      ? path.dirname(previousGame.goldberg_dll_path)
      : undefined)

  const enriched = await enrichApp(
    appid,
    settings.steamApiKey,
    mergedRaw,
    db,
    forceRefresh,
    resolvedDllDir
  )

  const diff = diffAchievements(previousAchievements, enriched.achievements)
  const newlyPlatinum = isNewPlatinum(
    hadPriorRows,
    previousGame?.has_platinum ?? 0,
    enriched.game.has_platinum
  )

  // 5. Write to SQLite (replace drops orphan rows like invented INI meta names)
  upsertGame(db, enriched.game)
  replaceAchievementsForGame(db, appid, enriched.achievements)

  // 5b. Auto-register GSE / Goldberg save folders into Ludusavi GUI config.yaml
  try {
    const guiConfigPath = resolveLudusaviGuiConfigPath()
    const title = enriched.game.ludusavi_title || enriched.game.name
    if (guiConfigPath && title) {
      const gseFromDiscovery = forThisApp
        .filter((d) => GOLDBERG_JSON_SOURCES.includes(d.source))
        .map((d) => path.dirname(d.filePath))
      const gseFromRoots = getGseSaveFoldersForAppid(appid, settings)
      const saveFolders = [...new Set([...gseFromRoots, ...gseFromDiscovery])]
      if (saveFolders.length > 0) {
        syncGseSavesToLudusavi(appid, title, saveFolders, guiConfigPath)
      }
    }
  } catch {
    // Non-blocking
  }

  // 6. Rebuild profile_stats.json
  regenerateProfileStats(db)

  // 7. Warm local image cache (non-blocking)
  void (async () => {
    const coverRemoteUrl = await getStoreCoverUrl(db, appid)
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
      forceRefresh
    })
  })().catch(() => {})

  if (!suppressNotifications && hadPriorRows) {
    if (diff.unlocked.length > 0) {
      notifyUnlocks(appid, enriched.game.name, diff.unlocked)
    }
    if (newlyPlatinum) {
      notifyPlatinumUnlock(appid, enriched.game.name)
    }
  }

  notifyLibraryUpdated(appid)
}
