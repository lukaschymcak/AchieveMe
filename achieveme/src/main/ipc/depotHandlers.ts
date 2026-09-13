import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/database'
import { getGame, saveManifestGids, saveUpdateStatus } from '../db/repository'
import { loadSettings } from '../settings'
import { notifyLibraryUpdated } from '../achievement/libraryNotifyService'
import { downloadManifest, searchDepotGames } from '../achievement/hubcapService'
import { processZip } from '../achievement/manifestZipService'
import { cancelDownload, startDownload } from '../achievement/depotRunnerService'
import { scanSteamApiDll } from '../achievement/depotScanUtils'
import { checkGameUpdate, runManifestChecker, runStartupUpdateCheck } from '../achievement/manifestCheckerService'
import { parseManifestGidsJson, pickManifestGids } from '../../shared/manifestUpdateUtils'
import type {
  DepotCancelMode,
  DepotDownloadStartRequest,
  DepotSearchResponse,
  GameData,
  ManifestCheckResult,
  ManifestCheckGameResult,
  SteamApiDllInfo
} from '../../shared/types'
import { resolveDepotOutputDir } from './handlerUtils'

export function registerDepotHandlers(): void {
  ipcMain.handle(
    'depot:search',
    (_event, query: string, mode: 'games' | 'dlc' = 'games'): Promise<DepotSearchResponse> =>
      searchDepotGames(query, mode)
  )

  ipcMain.handle(
    'depot:download-manifest',
    async (event, appId: string, channelId: string): Promise<string> => {
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
    (_event, appid: string): Promise<ManifestCheckGameResult> => checkGameUpdate(getDb(), appid)
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
        await downloadManifest(clean, zipPath, `manifest:get-game-data:progress:${clean}`, win ?? undefined)
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
      if (!Object.keys(gids).length) throw new Error('No manifest GIDs for selected depots.')
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

      // Use cached ZIP if available; download fresh only if missing
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

  // Trigger a startup update check (fire-and-forget, used from settingsHandlers after save)
  ipcMain.handle('manifest:startup-update-check', async (): Promise<void> => {
    void runStartupUpdateCheck(getDb()).catch(() => undefined)
  })
}
