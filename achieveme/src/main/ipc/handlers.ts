import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { app } from 'electron'
import { getDb } from '../db/database'
import {
  getAllGames,
  getGame,
  getAchievementsForGame,
  getSaveLocationsForApp,
  deleteGame,
  saveManifestGids,
  saveUpdateStatus
} from '../db/repository'
import { parseManifestGidsJson, pickManifestGids } from '../../shared/manifestUpdateUtils'
import { getStoreCoverUrl } from '../achievement/steamApiClient'
import { getSteamLibraryHeroUrl } from '../../shared/steamUrls'
import { loadSettings, saveSettings, normalizeSettings } from '../settings'
import { syncLoginItemSettings } from '../loginItemService'
import { startPlaytimeTracker, stopPlaytimeTracker } from '../achievement/playtimeService'
import { startWatcher, pruneOrphanedGames } from '../achievement/watcherService'
import { scanAllSources } from '../achievement/discoveryService'
import { processAppId } from '../achievement/processAppId'
import { buildFullBackupZip } from '../achievement/exportZipService'
import { importFullBackupZip } from '../achievement/importZipService'
import { normalizeProfileStats, regenerateProfileStats } from '../achievement/profileStatsService'
import { applyGoldberg } from '../achievement/goldbergSetupService'
import { previewUnlockToast } from '../achievement/unlockNotifyService'
import {
  acknowledgeSessionRecap,
  previewSessionRecap
} from '../achievement/sessionRecapService'
import type {
  ProfileStats,
  GameSummary,
  GameDetail,
  AppSettings,
  ImportResult,
  SteamSearchResult,
  GoldbergApplyRequest,
  SteamApiDllInfo,
  GameExecutable,
  ResolveGameExecutablesResult,
  SetGameLaunchConfigRequest,
  SteamlessRunResult,
  DepotCancelMode,
  DepotDownloadStartRequest,
  DepotSearchResponse,
  GameData,
  ManifestCheckResult,
  ManifestCheckGameResult
} from '../../shared/types'
import {
  LAUNCH_NEEDS_EXE,
  launchGame,
  listInstallExecutables,
  resolveGameExecutables,
  setGameLaunchConfig
} from '../achievement/gameLaunchService'
import {
  runSteamlessUnpack,
  validateSteamlessFolder
} from '../achievement/steamlessService'
import {
  downloadManifest,
  searchDepotGames
} from '../achievement/hubcapService'
import { processZip } from '../achievement/manifestZipService'
import {
  cancelDownload,
  startDownload
} from '../achievement/depotRunnerService'
import { scanSteamApiDll } from '../achievement/depotScanUtils'
import {
  checkGameUpdate,
  runManifestChecker,
  runStartupUpdateCheck
} from '../achievement/manifestCheckerService'
import { notifyLibraryUpdated } from '../achievement/libraryNotifyService'
import { resolveGameRoot } from '../achievement/gameLaunchUtils'

/**
 * Resolves DepotDownloader `-dir` from a possibly deep install/DLL path.
 *
 * @param installPath - Stored install path (often steam_api.dll folder).
 * @param gameName - Library game title for folder-name matching.
 */
function resolveDepotOutputDir(installPath: string, gameName: string): string {
  const resolved = resolveGameRoot(installPath, gameName)
  if (resolved.status === 'confident') return resolved.root
  if (resolved.status === 'unsure') return resolved.candidatePath
  return path.resolve(installPath)
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-profile-stats', (): ProfileStats | null => {
    const statsPath = path.join(app.getPath('userData'), 'profile_stats.json')
    try {
      const text = fs.readFileSync(statsPath, 'utf8')
      return normalizeProfileStats(JSON.parse(text) as ProfileStats)
    } catch {
      return null
    }
  })

  ipcMain.handle('get-all-games', async (): Promise<GameSummary[]> => {
    const db = getDb()
    const games = getAllGames(db)

    const summaries: GameSummary[] = []
    for (const g of games) {
      const cover_url = await getStoreCoverUrl(db, g.appid)
      summaries.push({
        appid: g.appid,
        name: g.name,
        cover_url,
        total_achievements: g.total_achievements,
        unlocked_achievements: g.unlocked_achievements,
        completion_pct: g.completion_pct,
        has_platinum: g.has_platinum === 1,
        last_unlocked_at: g.last_unlocked_at,
        playtime_seconds: g.playtime_seconds ?? 0,
        install_path: g.install_path ?? '',
        launch_exe: g.launch_exe ?? '',
        update_status: g.update_status ?? ''
      })
    }
    return summaries
  })

  ipcMain.handle('get-game-detail', async (_event, appid: string): Promise<GameDetail | null> => {
    const db = getDb()
    const game = getGame(db, appid)
    if (!game) return null
    const achievements = getAchievementsForGame(db, appid)
    const cover_url = await getStoreCoverUrl(db, appid)
    const backdrop_url = getSteamLibraryHeroUrl(appid)
    return { game, achievements, cover_url, backdrop_url }
  })

  ipcMain.handle('get-settings', (): AppSettings => {
    return loadSettings()
  })

  ipcMain.handle('save-settings', async (_event, settings: AppSettings): Promise<void> => {
    const normalized = normalizeSettings(settings)
    if (normalized.steamlessFolder.trim()) {
      normalized.steamlessFolder = validateSteamlessFolder(normalized.steamlessFolder)
    } else {
      normalized.steamlessFolder = ''
    }
    saveSettings(normalized)
    syncLoginItemSettings(normalized)
    if (normalized.playtimeTrackingEnabled) {
      startPlaytimeTracker()
    } else {
      stopPlaytimeTracker()
    }
    await startWatcher(normalized)
  })

  ipcMain.handle('refresh-game', async (_event, appid: string): Promise<void> => {
    const settings = loadSettings()
    await processAppId(appid, settings, true, true)
  })

  ipcMain.handle('refresh', async (): Promise<void> => {
    const settings = loadSettings()
    const db = getDb()

    pruneOrphanedGames(settings)

    const discovered = scanAllSources(settings)
    const appids = [...new Set(discovered.map((d) => d.appid))]
    for (const appid of appids) {
      await processAppId(appid, settings, true, true)
    }
    const dbGames = getAllGames(db)
    for (const game of dbGames) {
      if (!appids.includes(game.appid)) {
        await processAppId(game.appid, settings, true, true)
      }
    }

    // Fire-and-forget — leave existing update_status alone on failure
    void runStartupUpdateCheck(db).catch(() => undefined)
  })

  ipcMain.handle('delete-game', async (_event, appid: string): Promise<void> => {
    const db = getDb()
    const locations = getSaveLocationsForApp(db, appid)
    const deletedFolders = new Set<string>()

    for (const loc of locations) {
      const folder = path.dirname(loc.file_path)
      const folderKey = folder.toLowerCase()
      if (deletedFolders.has(folderKey)) continue
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true })
        deletedFolders.add(folderKey)
      }
    }

    deleteGame(db, appid)
    regenerateProfileStats(db)
  })

  ipcMain.handle('export-zip', async (): Promise<void> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Backup',
      defaultPath: 'achieveme-backup.zip',
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return

    const db = getDb()
    const settings = loadSettings()
    buildFullBackupZip(db, settings, filePath)
  })

  ipcMain.handle('import-zip', async (): Promise<ImportResult | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Backup',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const db = getDb()
    const settings = loadSettings()
    return importFullBackupZip(db, filePaths[0], settings)
  })

  ipcMain.handle('browse-sound-path', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select unlock sound',
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('preview-unlock-toast', (): void => {
    previewUnlockToast()
  })

  ipcMain.handle('preview-session-recap', (): void => {
    previewSessionRecap()
  })

  ipcMain.on('session-recap-done', () => {
    acknowledgeSessionRecap()
  })

  ipcMain.handle('search-steam-games', (_event, query: string): Promise<SteamSearchResult[]> => {
    return new Promise((resolve) => {
      const term = encodeURIComponent(query.trim())
      if (!term) {
        resolve([])
        return
      }
      const url = `https://store.steampowered.com/api/storesearch/?term=${term}&l=english&cc=US`
      https
        .get(url, { headers: { 'User-Agent': 'AchieveMe/1.0' } }, (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })
          res.on('end', () => {
            try {
              const json = JSON.parse(data) as {
                items?: Array<{
                  id?: number | string
                  name?: string
                  tiny_image?: string
                }>
              }
              const results: SteamSearchResult[] = (json.items ?? [])
                .filter((item) => item.id !== undefined)
                .map((item) => ({
                  appid: String(item.id),
                  name: item.name ?? `App ${item.id}`,
                  imageUrl: item.tiny_image ?? null
                }))
              resolve(results)
            } catch {
              resolve([])
            }
          })
        })
        .on('error', () => resolve([]))
    })
  })

  ipcMain.handle('browse-dll-path', async (): Promise<SteamApiDllInfo | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select steam_api.dll or steam_api64.dll',
      filters: [{ name: 'Steam API DLL', extensions: ['dll'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const dllPath = path.resolve(filePaths[0])
    const fileName = path.basename(dllPath)
    const lower = fileName.toLowerCase()
    if (lower !== 'steam_api.dll' && lower !== 'steam_api64.dll') {
      throw new Error('Select steam_api.dll or steam_api64.dll.')
    }
    if (!fs.existsSync(dllPath)) {
      throw new Error('Steam API DLL was not found.')
    }

    return {
      path: dllPath,
      fileName,
      directory: path.dirname(dllPath),
      architecture: lower === 'steam_api64.dll' ? 'x64' : 'x86'
    }
  })

  ipcMain.handle('apply-goldberg', async (event, request: GoldbergApplyRequest): Promise<void> => {
    const settings = loadSettings()
    await applyGoldberg(request, settings, (line) => {
      event.sender.send('goldberg-log', line)
    })
  })

  ipcMain.handle('browse-game-install-folder', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select game install folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return path.resolve(filePaths[0])
  })

  ipcMain.handle(
    'list-game-executables',
    (_event, installPath: string): GameExecutable[] => listInstallExecutables(installPath)
  )

  ipcMain.handle(
    'resolve-game-executables',
    (_event, appid: string, acceptedRoot?: string): ResolveGameExecutablesResult =>
      resolveGameExecutables(getDb(), appid, acceptedRoot)
  )

  ipcMain.handle(
    'set-game-launch-config',
    (_event, request: SetGameLaunchConfigRequest): void => {
      setGameLaunchConfig(getDb(), request)
    }
  )

  ipcMain.handle('launch-game', async (_event, appid: string): Promise<void> => {
    try {
      launchGame(getDb(), appid)
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      if (code === LAUNCH_NEEDS_EXE) {
        throw new Error(`${LAUNCH_NEEDS_EXE}: Select a game executable to play.`)
      }
      throw err
    }
  })

  ipcMain.handle('browse-steamless-folder', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Steamless folder',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return validateSteamlessFolder(filePaths[0])
  })

  ipcMain.handle('browse-steamless-exe', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select executable to unpack with Steamless',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return path.resolve(filePaths[0])
  })

  ipcMain.handle(
    'run-steamless',
    async (event, exePath: string): Promise<SteamlessRunResult> => {
      const settings = loadSettings()
      const folder = settings.steamlessFolder?.trim() ?? ''
      if (!folder) {
        throw new Error('Set the Steamless folder in Settings first.')
      }
      return runSteamlessUnpack(folder, exePath, (line) => {
        event.sender.send('steamless-log', line)
      })
    }
  )

  ipcMain.handle(
    'depot:search',
    (_event, query: string, mode: 'games' | 'dlc' = 'games'): Promise<DepotSearchResponse> =>
      searchDepotGames(query, mode)
  )

  ipcMain.handle(
    'depot:download-manifest',
    async (
      event,
      appId: string,
      channelId: string
    ): Promise<string> => {
      const cacheDir = path.join(app.getPath('userData'), 'manifest_cache')
      const destination = path.join(cacheDir, `${appId}.zip`)
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return downloadManifest(appId, destination, channelId, win)
    }
  )

  ipcMain.handle('depot:process-zip', (_event, zipPath: string): Promise<GameData> =>
    processZip(zipPath)
  )

  ipcMain.handle(
    'depot:start-download',
    async (event, request: DepotDownloadStartRequest): Promise<void> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No BrowserWindow for depot download.')
      return startDownload(request, win)
    }
  )

  ipcMain.handle(
    'depot:cancel-download',
    async (_event, channelId: string, mode: DepotCancelMode = 'keep'): Promise<void> =>
      cancelDownload(channelId, mode)
  )

  ipcMain.handle('depot:browse-output-folder', async (): Promise<string | null> => {
    const settings = loadSettings()
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select download output folder',
      defaultPath: settings.depotDownloadPath.trim() || undefined,
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return path.resolve(filePaths[0])
  })

  ipcMain.handle(
    'depot:scan-dll',
    (_event, rootDir: string): SteamApiDllInfo | null => scanSteamApiDll(rootDir)
  )

  ipcMain.handle(
    'manifest:check',
    (_event, appIds: string[]): Promise<ManifestCheckResult[]> => runManifestChecker(appIds)
  )

  ipcMain.handle(
    'manifest:save-gids',
    (
      _event,
      appid: string,
      gids: Record<string, string>,
      gameName?: string,
      installPath?: string
    ): void => {
      saveManifestGids(getDb(), appid, gids, gameName, installPath)
      notifyLibraryUpdated(appid)
    }
  )

  ipcMain.handle(
    'manifest:check-game',
    (_event, appid: string): Promise<ManifestCheckGameResult> =>
      checkGameUpdate(getDb(), appid)
  )

  ipcMain.handle(
    'manifest:get-game-data',
    async (event, appid: string, forceRefresh: boolean): Promise<GameData> => {
      const clean = String(appid || '').trim()
      if (!clean) throw new Error('AppID is required.')
      const win = BrowserWindow.fromWebContents(event.sender)
      const cacheDir = path.join(app.getPath('userData'), 'manifest_cache')
      const zipPath = path.join(cacheDir, `${clean}.zip`)
      if (forceRefresh || !fs.existsSync(zipPath)) {
        await downloadManifest(
          clean,
          zipPath,
          `manifest:get-game-data:progress:${clean}`,
          win ?? undefined
        )
      }
      return processZip(zipPath)
    }
  )

  ipcMain.handle(
    'manifest:update-game',
    async (
      event,
      appid: string,
      installPath: string,
      selectedDepots: string[],
      steamUsername?: string
    ): Promise<void> => {
      const clean = String(appid || '').trim()
      const outDir = String(installPath || '').trim()
      if (!clean) throw new Error('AppID is required.')
      if (!outDir) throw new Error('Install path is required.')
      if (!Array.isArray(selectedDepots) || selectedDepots.length === 0) {
        throw new Error('No depots selected.')
      }

      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No BrowserWindow for game update.')

      const game = getGame(getDb(), clean)
      if (!game) throw new Error(`Game ${clean} not found in library.`)

      const cacheDir = path.join(app.getPath('userData'), 'manifest_cache')
      const zipPath = path.join(cacheDir, `${clean}.zip`)
      await downloadManifest(clean, zipPath, `manifest:update-game:progress:${clean}`, win)
      const gameData = await processZip(zipPath)

      const contentDir = resolveDepotOutputDir(outDir, game.name || gameData.gameName)
      const channelId = `depot:${clean}:update`
      await startDownload(
        {
          gameData,
          selectedDepots,
          libraryPath: contentDir,
          outputPath: contentDir,
          steamUsername,
          maxDownloads: 20,
          channelId
        },
        win
      )

      const gids = pickManifestGids(gameData.manifests, selectedDepots)
      if (!Object.keys(gids).length) {
        throw new Error('No manifest GIDs for selected depots.')
      }
      saveManifestGids(getDb(), clean, gids, game.name || gameData.gameName)
      saveUpdateStatus(getDb(), clean, 'up_to_date')
      notifyLibraryUpdated(clean)
    }
  )

  ipcMain.handle(
    'manifest:validate-game',
    async (
      event,
      appid: string,
      installPath: string,
      selectedDepots: string[],
      steamUsername?: string
    ): Promise<void> => {
      const clean = String(appid || '').trim()
      const outDir = String(installPath || '').trim()
      if (!clean) throw new Error('AppID is required.')
      if (!outDir) throw new Error('Install path is required.')
      if (!Array.isArray(selectedDepots) || selectedDepots.length === 0) {
        throw new Error('No depots selected.')
      }

      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No BrowserWindow for game validate.')

      const game = getGame(getDb(), clean)
      if (!game) throw new Error(`Game ${clean} not found in library.`)

      const storedGids = parseManifestGidsJson(game.manifest_gids)
      if (!Object.keys(storedGids).length) {
        throw new Error('No stored manifest GIDs — download the game first.')
      }

      const cacheDir = path.join(app.getPath('userData'), 'manifest_cache')
      const zipPath = path.join(cacheDir, `${clean}.zip`)

      // Use cached ZIP if available (keys stay valid); download fresh only if missing
      if (!fs.existsSync(zipPath)) {
        await downloadManifest(clean, zipPath, `manifest:validate-game:progress:${clean}`, win)
      }

      const gameData = await processZip(zipPath)
      const contentDir = resolveDepotOutputDir(outDir, game.name || gameData.gameName)

      await startDownload(
        {
          gameData,
          selectedDepots,
          libraryPath: contentDir,
          outputPath: contentDir,
          steamUsername,
          maxDownloads: 20,
          channelId: `depot:${clean}:validate`
        },
        win
      )

      // Repair only — do not change manifest_gids or update_status
      notifyLibraryUpdated(clean)
    }
  )
}
