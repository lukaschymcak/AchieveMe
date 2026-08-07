import type {
  ProfileStats,
  GameSummary,
  GameDetail,
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
  ManifestCheckGameResult
} from '../../shared/types'

declare global {
  interface Window {
    api: {
      getProfileStats(): Promise<ProfileStats | null>
      getAllGames(): Promise<GameSummary[]>
      getGameDetail(appid: string): Promise<GameDetail | null>
      getSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<void>
      refresh(): Promise<void>
      refreshGame(appid: string): Promise<void>
      deleteGame(appid: string): Promise<void>
      searchSteamGames(query: string): Promise<SteamSearchResult[]>
      browseDllPath(): Promise<SteamApiDllInfo | null>
      browseSoundPath(): Promise<string | null>
      previewUnlockToast(): Promise<void>
      previewSessionRecap(): Promise<void>
      sessionRecapDone(): void
      applyGoldberg(request: GoldbergApplyRequest): Promise<void>
      browseGameInstallFolder(): Promise<string | null>
      listGameExecutables(installPath: string): Promise<GameExecutable[]>
      resolveGameExecutables(
        appid: string,
        acceptedRoot?: string
      ): Promise<ResolveGameExecutablesResult>
      setGameLaunchConfig(request: SetGameLaunchConfigRequest): Promise<void>
      launchGame(appid: string): Promise<void>
      browseSteamlessFolder(): Promise<string | null>
      browseSteamlessExe(): Promise<string | null>
      runSteamless(exePath: string): Promise<SteamlessRunResult>
      depotSearch(query: string, mode?: 'games' | 'dlc'): Promise<DepotSearchResponse>
      depotDownloadManifest(appId: string, channelId: string): Promise<string>
      depotProcessZip(zipPath: string): Promise<GameData>
      depotStartDownload(request: DepotDownloadStartRequest): Promise<void>
      depotCancelDownload(channelId: string, mode?: DepotCancelMode): Promise<void>
      depotBrowseOutputFolder(): Promise<string | null>
      depotScanDll(rootDir: string): Promise<SteamApiDllInfo | null>
      manifestCheck(appIds: string[]): Promise<ManifestCheckResult[]>
      manifestSaveGids(
        appid: string,
        gids: Record<string, string>,
        gameName?: string,
        installPath?: string
      ): Promise<void>
      manifestCheckGame(appid: string): Promise<ManifestCheckGameResult>
      manifestGetGameData(appid: string, forceRefresh: boolean): Promise<GameData>
      manifestUpdateGame(
        appid: string,
        installPath: string,
        selectedDepots: string[],
        steamUsername?: string
      ): Promise<void>
      manifestValidateGame(
        appid: string,
        installPath: string,
        selectedDepots: string[],
        steamUsername?: string
      ): Promise<void>
      onDepotProgress(cb: (event: DepotProgressEvent) => void): void
      offDepotProgress(cb?: (event: DepotProgressEvent) => void): void
      onDepotLog(channelId: string, cb: (payload: DepotProgressEvent) => void): void
      offDepotLog(channelId: string): void
      onSteamlessLog(cb: (line: string) => void): void
      offSteamlessLog(): void
      onGoldbergLog(cb: (line: string) => void): void
      offGoldbergLog(): void
      onLibraryUpdated(cb: (payload: LibraryUpdatedPayload) => void): void
      offLibraryUpdated(cb: (payload: LibraryUpdatedPayload) => void): void
      onNavigateToGame(cb: (appid: string) => void): void
      offNavigateToGame(cb: (appid: string) => void): void
      onSessionRecap(cb: (payload: SessionRecapPayload) => void): void
      offSessionRecap(cb: (payload: SessionRecapPayload) => void): void
    }
  }
}

export {}
