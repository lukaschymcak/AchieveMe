import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult, SteamSearchResult, GoldbergApplyRequest, SteamApiDllInfo, LibraryUpdatedPayload, SessionRecapPayload, GameExecutable, ResolveGameExecutablesResult, SetGameLaunchConfigRequest, SteamlessRunResult } from '../shared/types'

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

contextBridge.exposeInMainWorld('api', {
  getProfileStats: (): Promise<ProfileStats | null> =>
    ipcRenderer.invoke('get-profile-stats'),

  getAllGames: (): Promise<GameSummary[]> =>
    ipcRenderer.invoke('get-all-games'),

  getGameDetail: (appid: string): Promise<GameDetail | null> =>
    ipcRenderer.invoke('get-game-detail', appid),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('save-settings', settings),

  refresh: (): Promise<void> =>
    ipcRenderer.invoke('refresh'),

  refreshGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('refresh-game', appid),

  deleteGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('delete-game', appid),

  exportZip: (): Promise<void> =>
    ipcRenderer.invoke('export-zip'),

  importZip: (): Promise<ImportResult | null> =>
    ipcRenderer.invoke('import-zip'),

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

  listGameExecutables: (installPath: string): Promise<GameExecutable[]> =>
    ipcRenderer.invoke('list-game-executables', installPath),

  resolveGameExecutables: (
    appid: string,
    acceptedRoot?: string
  ): Promise<ResolveGameExecutablesResult> =>
    ipcRenderer.invoke('resolve-game-executables', appid, acceptedRoot),

  setGameLaunchConfig: (request: SetGameLaunchConfigRequest): Promise<void> =>
    ipcRenderer.invoke('set-game-launch-config', request),

  launchGame: (appid: string): Promise<void> =>
    ipcRenderer.invoke('launch-game', appid),

  browseSteamlessFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-steamless-folder'),

  browseSteamlessExe: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-steamless-exe'),

  runSteamless: (exePath: string): Promise<SteamlessRunResult> =>
    ipcRenderer.invoke('run-steamless', exePath),

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
  }
})
