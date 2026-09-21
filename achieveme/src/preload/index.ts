import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  ProfileStats,
  GameSummary,
  GameDetail,
  GameHunterStats,
  AppSettings,
  SteamSearchResult,
  GoldbergApplyRequest,
  SteamApiDllInfo,
  LibraryUpdatedPayload,
  SessionRecapPayload,
  GameExecutable,
  ResolveGameExecutablesResult,
  SetGameLaunchConfigRequest,
  SteamlessRunResult,
  DepotSearchResponse,
  GameData,
  DepotDownloadStartRequest,
  DepotCancelMode,
  DepotProgressEvent,
  ManifestCheckResult,
  ManifestCheckGameResult,
  NewsPayload,
  GetNewsOptions,
  ImportScannedInstallRequest,
  ScannedInstallCandidate,
  BootWarmProgress,
  BootWarmResult,
  WantedGame,
  WantedAddResult,
  AppUpdateState,
  PendingChangelog
} from '../shared/types'
import type { LudusaviSnapshot } from '../shared/ludusaviApiUtils'

const showChangelogCallbacks = new Set<(payload: PendingChangelog) => void>()

function dispatchShowChangelog(_event: IpcRendererEvent, payload: PendingChangelog): void {
  for (const cb of showChangelogCallbacks) {
    cb(payload)
  }
}

const updateStateCallbacks = new Set<(payload: AppUpdateState) => void>()

function dispatchUpdateState(_event: IpcRendererEvent, payload: AppUpdateState): void {
  for (const cb of updateStateCallbacks) {
    cb(payload)
  }
}

const libraryUpdatedCallbacks = new Set<(payload: LibraryUpdatedPayload) => void>()

function dispatchLibraryUpdated(
  _event: IpcRendererEvent,
  payload: LibraryUpdatedPayload
): void {
  for (const cb of libraryUpdatedCallbacks) {
    cb(payload)
  }
}

const navigateToGameCallbacks = new Set<(appid: string) => void>()

function dispatchNavigateToGame(_event: IpcRendererEvent, appid: string): void {
  for (const cb of navigateToGameCallbacks) {
    cb(appid)
  }
}

const sessionRecapCallbacks = new Set<(payload: SessionRecapPayload) => void>()

function dispatchSessionRecap(_event: IpcRendererEvent, payload: SessionRecapPayload): void {
  for (const cb of sessionRecapCallbacks) {
    cb(payload)
  }
}

const depotProgressCallbacks = new Set<(event: DepotProgressEvent) => void>()

function dispatchDepotProgress(_event: IpcRendererEvent, payload: DepotProgressEvent): void {
  for (const cb of depotProgressCallbacks) {
    cb(payload)
  }
}

contextBridge.exposeInMainWorld('api', {
  getNews: (options: GetNewsOptions | boolean = {}): Promise<NewsPayload> => {
    if (typeof options === 'boolean') {
      return ipcRenderer.invoke('get-news', { forceRefresh: options })
    }
    return ipcRenderer.invoke('get-news', options)
  },

  runBootWarm: (): Promise<BootWarmResult> =>
    ipcRenderer.invoke('boot:run-warm'),

  onBootWarmProgress: (cb: (progress: BootWarmProgress) => void): void => {
    ipcRenderer.on('boot:warm-progress', (_event: IpcRendererEvent, progress: BootWarmProgress) => {
      cb(progress)
    })
  },

  offBootWarmProgress: (): void => {
    ipcRenderer.removeAllListeners('boot:warm-progress')
  },

  getProfileStats: (): Promise<ProfileStats | null> =>
    ipcRenderer.invoke('get-profile-stats'),

  getAllGames: (): Promise<GameSummary[]> =>
    ipcRenderer.invoke('get-all-games'),

  getGameDetail: (appid: string): Promise<GameDetail | null> =>
    ipcRenderer.invoke('get-game-detail', appid),

  getGameHunterStats: (
    appid: string,
    options?: { forceRefresh?: boolean }
  ): Promise<GameHunterStats> =>
    ipcRenderer.invoke('get-game-hunter-stats', appid, options),

  warmHunterLibrary: (): Promise<{
    warmed: number
    skipped: number
    failed: number
  }> => ipcRenderer.invoke('hunter:warm-library'),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('get-settings'),

  getAppRuntime: (): Promise<{
    isPackaged: boolean
    isPortable: boolean
    loginItemsSupported: boolean
  }> => ipcRenderer.invoke('get-app-runtime'),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('save-settings', settings),

  refresh: (): Promise<void> =>
    ipcRenderer.invoke('refresh'),

  refreshGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('refresh-game', appid),

  deleteGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('delete-game', appid),

  listWantedGames: (): Promise<WantedGame[]> => ipcRenderer.invoke('wanted:list'),

  addWantedGame: (input: {
    appid: string
    name: string
    coverUrl?: string
  }): Promise<WantedAddResult> => ipcRenderer.invoke('wanted:add', input),

  removeWantedGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('wanted:remove', appid),

  searchSteamGames: (query: string): Promise<SteamSearchResult[]> =>
    ipcRenderer.invoke('search-steam-games', query),

  browseDllPath: (): Promise<SteamApiDllInfo | null> =>
    ipcRenderer.invoke('browse-dll-path'),

  browseSoundPath: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-sound-path'),

  previewUnlockToast: (): Promise<void> =>
    ipcRenderer.invoke('preview-unlock-toast'),

  previewSessionRecap: (): Promise<void> =>
    ipcRenderer.invoke('preview-session-recap'),

  sessionRecapDone: (): void => {
    ipcRenderer.send('session-recap-done')
  },

  applyGoldberg: (request: GoldbergApplyRequest): Promise<void> =>
    ipcRenderer.invoke('apply-goldberg', request),

  browseGameInstallFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-game-install-folder'),

  listGameExecutables: (installPath: string, gameName?: string): Promise<GameExecutable[]> =>
    ipcRenderer.invoke('list-game-executables', installPath, gameName),

  resolveGameExecutables: (
    appid: string,
    acceptedRoot?: string
  ): Promise<ResolveGameExecutablesResult> =>
    ipcRenderer.invoke('resolve-game-executables', appid, acceptedRoot),

  setGameLaunchConfig: (request: SetGameLaunchConfigRequest): Promise<void> =>
    ipcRenderer.invoke('set-game-launch-config', request),

  launchGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('launch-game', appid),

  openPath: (absolutePath: string | string[]): Promise<void> =>
    ipcRenderer.invoke('open-path', absolutePath),

  browseSteamlessFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-steamless-folder'),

  browseSteamlessExe: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-steamless-exe'),

  runSteamless: (exePath: string, appid?: string): Promise<SteamlessRunResult> =>
    ipcRenderer.invoke('run-steamless', exePath, appid),

  browseLudusaviPath: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-ludusavi-path'),

  ludusaviCloudStatus: (): Promise<{
    configured: boolean
    apiUrlHost: string | null
  }> => ipcRenderer.invoke('ludusavi:cloud-status'),

  setGameCloudSavesEnabled: (
    appid: string,
    enabled: boolean
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('games:set-cloud-saves-enabled', appid, enabled),

  ludusaviCloudUploadGame: (
    appid: string,
    backupId: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('ludusavi:cloud-upload-game', appid, backupId),

  ludusaviCloudListGame: (
    appid: string
  ): Promise<
    | { ok: true; artifacts: Array<{ id: string; appid: string; bytes: number; sha256: string; createdAt: string }> }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('ludusavi:cloud-list-game', appid),

  ludusaviCloudDownloadGame: (
    appid: string,
    artifactId?: string
  ): Promise<{ ok: boolean; error?: string; backupId?: string }> =>
    ipcRenderer.invoke('ludusavi:cloud-download-game', appid, artifactId),

  ludusaviCloudDownload: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('ludusavi:cloud-download'),

  ludusaviBackupGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('ludusavi:backup-game', appid),

  ludusaviListBackups: (
    appid: string
  ): Promise<{ title: string; snapshots: LudusaviSnapshot[] } | string> =>
    ipcRenderer.invoke('ludusavi:list-backups', appid),

  ludusaviListCustomPaths: (
    appid: string
  ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke('ludusavi:list-custom-paths', appid),

  ludusaviAddCustomPath: (
    appid: string,
    folder: string
  ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke('ludusavi:add-custom-path', appid, folder),

  ludusaviRemoveCustomPath: (
    appid: string,
    folder: string
  ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke('ludusavi:remove-custom-path', appid, folder),

  ludusaviRestoreGame: (appid: string, backupId: string): Promise<void> =>
    ipcRenderer.invoke('ludusavi:restore-game', appid, backupId),

  ludusaviBackupLibrary: (): Promise<void> =>
    ipcRenderer.invoke('ludusavi:backup-library'),

  ludusaviGetQueue: (): Promise<{ runningAppid: string | null; pending: string[] }> =>
    ipcRenderer.invoke('ludusavi:get-queue'),

  depotSearch: (query: string, mode: 'games' | 'dlc' = 'games'): Promise<DepotSearchResponse> =>
    ipcRenderer.invoke('depot:search', query, mode),

  depotDownloadManifest: (appId: string, channelId: string): Promise<string> =>
    ipcRenderer.invoke('depot:download-manifest', appId, channelId),

  depotProcessZip: (zipPath: string): Promise<GameData> =>
    ipcRenderer.invoke('depot:process-zip', zipPath),

  depotStartDownload: (request: DepotDownloadStartRequest): Promise<void> =>
    ipcRenderer.invoke('depot:start-download', request),

  depotCancelDownload: (channelId: string, mode: DepotCancelMode = 'keep'): Promise<void> =>
    ipcRenderer.invoke('depot:cancel-download', channelId, mode),

  depotBrowseOutputFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('depot:browse-output-folder'),

  depotScanDll: (rootDir: string): Promise<SteamApiDllInfo | null> =>
    ipcRenderer.invoke('depot:scan-dll', rootDir),

  manifestCheck: (appIds: string[]): Promise<ManifestCheckResult[]> =>
    ipcRenderer.invoke('manifest:check', appIds),

  manifestSaveGids: (
    appid: string,
    gids: Record<string, string>,
    gameName?: string,
    installPath?: string
  ): Promise<void> =>
    ipcRenderer.invoke('manifest:save-gids', appid, gids, gameName, installPath),

  scanInstalledGames: (
    roots?: string[],
    options?: { includeIgnored?: boolean }
  ): Promise<ScannedInstallCandidate[]> =>
    ipcRenderer.invoke('scan-installed-games', roots, options),

  importScannedInstall: (
    request: ImportScannedInstallRequest
  ): Promise<{ created: boolean }> =>
    ipcRenderer.invoke('import-scanned-install', request),

  proposeInstallScanRoots: (): Promise<string[]> =>
    ipcRenderer.invoke('propose-install-scan-roots'),

  manifestCheckGame: (appid: string): Promise<ManifestCheckGameResult> =>
    ipcRenderer.invoke('manifest:check-game', appid),

  manifestGetGameData: (appid: string, forceRefresh: boolean): Promise<GameData> =>
    ipcRenderer.invoke('manifest:get-game-data', appid, forceRefresh),

  manifestUpdateGame: (
    appid: string,
    installPath: string,
    selectedDepots: string[],
    steamUsername?: string
  ): Promise<void> =>
    ipcRenderer.invoke('manifest:update-game', appid, installPath, selectedDepots, steamUsername),

  manifestValidateGame: (
    appid: string,
    installPath: string,
    selectedDepots: string[],
    steamUsername?: string
  ): Promise<void> =>
    ipcRenderer.invoke('manifest:validate-game', appid, installPath, selectedDepots, steamUsername),

  onDepotProgress: (cb: (event: DepotProgressEvent) => void): void => {
    if (depotProgressCallbacks.size === 0) {
      ipcRenderer.on('depot:progress', dispatchDepotProgress)
    }
    depotProgressCallbacks.add(cb)
  },

  offDepotProgress: (cb?: (event: DepotProgressEvent) => void): void => {
    if (cb) {
      depotProgressCallbacks.delete(cb)
    } else {
      depotProgressCallbacks.clear()
    }
    if (depotProgressCallbacks.size === 0) {
      ipcRenderer.removeListener('depot:progress', dispatchDepotProgress)
    }
  },

  onDepotLog: (channelId: string, cb: (payload: DepotProgressEvent) => void): void => {
    ipcRenderer.on(channelId, (_event, payload: DepotProgressEvent) => cb(payload))
  },

  offDepotLog: (channelId: string): void => {
    ipcRenderer.removeAllListeners(channelId)
  },

  onSteamlessLog: (cb: (line: string) => void): void => {
    ipcRenderer.on('steamless-log', (_event, line: string) => cb(line))
  },

  offSteamlessLog: (): void => {
    ipcRenderer.removeAllListeners('steamless-log')
  },

  onGoldbergLog: (cb: (line: string) => void): void => {
    ipcRenderer.on('goldberg-log', (_event, line: string) => cb(line))
  },

  offGoldbergLog: (): void => {
    ipcRenderer.removeAllListeners('goldberg-log')
  },

  onLibraryUpdated: (cb: (payload: LibraryUpdatedPayload) => void): void => {
    if (libraryUpdatedCallbacks.size === 0) {
      ipcRenderer.on('library-updated', dispatchLibraryUpdated)
    }
    libraryUpdatedCallbacks.add(cb)
  },

  offLibraryUpdated: (cb: (payload: LibraryUpdatedPayload) => void): void => {
    libraryUpdatedCallbacks.delete(cb)
    if (libraryUpdatedCallbacks.size === 0) {
      ipcRenderer.removeListener('library-updated', dispatchLibraryUpdated)
    }
  },

  onNavigateToGame: (cb: (appid: string) => void): void => {
    if (navigateToGameCallbacks.size === 0) {
      ipcRenderer.on('navigate-to-game', dispatchNavigateToGame)
    }
    navigateToGameCallbacks.add(cb)
  },

  offNavigateToGame: (cb: (appid: string) => void): void => {
    navigateToGameCallbacks.delete(cb)
    if (navigateToGameCallbacks.size === 0) {
      ipcRenderer.removeListener('navigate-to-game', dispatchNavigateToGame)
    }
  },

  onSessionRecap: (cb: (payload: SessionRecapPayload) => void): void => {
    if (sessionRecapCallbacks.size === 0) {
      ipcRenderer.on('session-recap', dispatchSessionRecap)
    }
    sessionRecapCallbacks.add(cb)
  },

  offSessionRecap: (cb: (payload: SessionRecapPayload) => void): void => {
    sessionRecapCallbacks.delete(cb)
    if (sessionRecapCallbacks.size === 0) {
      ipcRenderer.removeListener('session-recap', dispatchSessionRecap)
    }
  },

  checkForUpdates: (): Promise<AppUpdateState> =>
    ipcRenderer.invoke('app:check-for-updates'),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke('app:install-update'),

  getUpdateState: (): Promise<AppUpdateState> =>
    ipcRenderer.invoke('app:get-update-state'),

  onUpdateStateChanged: (cb: (payload: AppUpdateState) => void): void => {
    if (updateStateCallbacks.size === 0) {
      ipcRenderer.on('app:update-state', dispatchUpdateState)
    }
    updateStateCallbacks.add(cb)
  },

  offUpdateStateChanged: (cb: (payload: AppUpdateState) => void): void => {
    updateStateCallbacks.delete(cb)
    if (updateStateCallbacks.size === 0) {
      ipcRenderer.removeListener('app:update-state', dispatchUpdateState)
    }
  },

  getPendingChangelog: (): Promise<PendingChangelog | null> =>
    ipcRenderer.invoke('app:get-pending-changelog'),

  getLatestChangelog: (): Promise<PendingChangelog | null> =>
    ipcRenderer.invoke('app:get-latest-changelog'),

  onShowChangelog: (cb: (payload: PendingChangelog) => void): void => {
    if (showChangelogCallbacks.size === 0) {
      ipcRenderer.on('app:show-changelog', dispatchShowChangelog)
    }
    showChangelogCallbacks.add(cb)
  },

  offShowChangelog: (cb: (payload: PendingChangelog) => void): void => {
    showChangelogCallbacks.delete(cb)
    if (showChangelogCallbacks.size === 0) {
      ipcRenderer.removeListener('app:show-changelog', dispatchShowChangelog)
    }
  }
})
