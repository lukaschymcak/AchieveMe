import { ipcMain } from 'electron'
import fs from 'node:fs'
import https from 'node:https'
import { getDb } from '../db/database'
import {
  upsertScannedInstall,
  addWantedGame,
  listWantedGames,
  removeWantedGame
} from '../db/repository'
import { loadSettings } from '../settings'
import { notifyLibraryUpdated } from '../achievement/libraryNotifyService'
import { getNews } from '../achievement/steamNewsService'
import { startBootWarm } from '../achievement/bootWarmService'
import { assertScannedInstallPath, scanInstalledGamesWithDb } from '../achievement/installedGamesScanService'
import { proposeInstallScanRoots } from '../../shared/installedGamesScanUtils'
import { getStoreCoverUrl } from '../achievement/steamApiClient'
import { cacheCoverUrl } from '../../shared/imageCacheUrls'
import { coverFilePath, ensureCoverCached } from '../achievement/imageCacheService'
import { getDefaultImageCacheDeps, getImagesCacheRoot } from '../achievement/imageCacheProtocol'
import type {
  BootWarmProgress,
  BootWarmResult,
  GetNewsOptions,
  ImportScannedInstallRequest,
  NewsPayload,
  ScannedInstallCandidate,
  SteamSearchResult,
  WantedAddResult,
  WantedGame
} from '../../shared/types'

export function registerMiscHandlers(): void {
  ipcMain.handle(
    'get-news',
    async (_event, options?: GetNewsOptions | boolean): Promise<NewsPayload> =>
      getNews(getDb(), typeof options === 'boolean' ? options : Boolean(options?.forceRefresh))
  )

  ipcMain.handle('boot:run-warm', async (event): Promise<BootWarmResult> =>
    startBootWarm(getDb(), (progress: BootWarmProgress) => {
      if (!event.sender.isDestroyed()) event.sender.send('boot:warm-progress', progress)
    })
  )

  ipcMain.handle('wanted:list', async (): Promise<WantedGame[]> => {
    const db = getDb()
    const games = listWantedGames(db)
    const cacheRoot = getImagesCacheRoot()
    const out: WantedGame[] = []
    for (const g of games) {
      const dest = coverFilePath(cacheRoot, g.appid)
      if (fs.existsSync(dest)) {
        out.push({ ...g, coverUrl: cacheCoverUrl(g.appid) })
      } else {
        const remoteCover = await getStoreCoverUrl(db, g.appid)
        const effective =
          remoteCover ||
          g.coverUrl ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`
        out.push({ ...g, coverUrl: effective ? cacheCoverUrl(g.appid) : '' })
        if (effective) {
          void ensureCoverCached(getDefaultImageCacheDeps(), g.appid, effective).catch(() => {})
        }
      }
    }
    return out
  })

  ipcMain.handle(
    'wanted:add',
    (_event, input: { appid: string; name: string; coverUrl?: string }): WantedAddResult => {
      const result = addWantedGame(getDb(), input)
      if (result.ok && result.created) {
        const remote =
          input.coverUrl ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${input.appid}/header.jpg`
        void ensureCoverCached(getDefaultImageCacheDeps(), input.appid, remote).catch(() => {})
      }
      return result
    }
  )

  ipcMain.handle('wanted:remove', (_event, appid: string): void => {
    removeWantedGame(getDb(), appid)
  })

  ipcMain.handle(
    'search-steam-games',
    (_event, query: string): Promise<SteamSearchResult[]> =>
      new Promise((resolve) => {
        const term = encodeURIComponent(query.trim())
        if (!term) return resolve([])
        const url = `https://store.steampowered.com/api/storesearch/?term=${term}&l=english&cc=US`
        https
          .get(url, { headers: { 'User-Agent': 'AchieveMe/1.0' } }, (res) => {
            let data = ''
            res.on('data', (chunk: Buffer) => { data += chunk.toString() })
            res.on('end', () => {
              try {
                const json = JSON.parse(data) as {
                  items?: Array<{ id?: number | string; name?: string; tiny_image?: string }>
                }
                resolve(
                  (json.items ?? [])
                    .filter((item) => item.id !== undefined)
                    .map((item) => ({
                      appid: String(item.id),
                      name: item.name ?? `App ${item.id}`,
                      imageUrl: item.tiny_image ?? null
                    }))
                )
              } catch {
                resolve([])
              }
            })
          })
          .on('error', () => resolve([]))
      })
  )

  ipcMain.handle(
    'scan-installed-games',
    (
      _event,
      roots?: string[],
      options?: { includeIgnored?: boolean }
    ): ScannedInstallCandidate[] => {
      const settings = loadSettings()
      const scanRoots =
        Array.isArray(roots) && roots.length > 0
          ? roots.map((r) => String(r || '').trim()).filter(Boolean)
          : settings.installScanRoots
      return scanInstalledGamesWithDb(getDb(), scanRoots, Boolean(options?.includeIgnored))
    }
  )

  ipcMain.handle(
    'import-scanned-install',
    (_event, request: ImportScannedInstallRequest): { created: boolean } => {
      const installPath = assertScannedInstallPath(request.installPath)
      const result = upsertScannedInstall(getDb(), {
        appid: request.appid,
        gameName: request.gameName,
        installPath,
        launchExe: request.launchExe
      })
      notifyLibraryUpdated(String(request.appid || '').trim())
      return result
    }
  )

  ipcMain.handle('propose-install-scan-roots', (): string[] => {
    const steamCandidates = [
      'C:\\Program Files (x86)\\Steam\\steamapps\\common',
      'C:\\Program Files\\Steam\\steamapps\\common',
      'D:\\SteamLibrary\\steamapps\\common',
      'E:\\SteamLibrary\\steamapps\\common',
      'F:\\SteamLibrary\\steamapps\\common'
    ]
    return proposeInstallScanRoots((p) => fs.existsSync(p), steamCandidates)
  })
}
