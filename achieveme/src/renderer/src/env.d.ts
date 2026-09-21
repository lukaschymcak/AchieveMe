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
} from '../../shared/types'
import type { LudusaviSnapshot } from '../../shared/ludusaviApiUtils'

declare global {
  interface Window {
    api: {
      getNews(options?: GetNewsOptions | boolean): Promise<NewsPayload>
      runBootWarm(): Promise<BootWarmResult>
      onBootWarmProgress(cb: (progress: BootWarmProgress) => void): void
      offBootWarmProgress(): void
      getProfileStats(): Promise<ProfileStats | null>
      getAllGames(): Promise<GameSummary[]>
      getGameDetail(appid: string): Promise<GameDetail | null>
      getGameHunterStats(
        appid: string,
        options?: { forceRefresh?: boolean }
      ): Promise<GameHunterStats>
      warmHunterLibrary(): Promise<{
        warmed: number
        skipped: number
        failed: number
      }>
      getSettings(): Promise<AppSettings>
      getAppRuntime(): Promise<{
        isPackaged: boolean
        isPortable: boolean
        loginItemsSupported: boolean
      }>
      saveSettings(settings: AppSettings): Promise<void>
      refresh(): Promise<void>
      refreshGame(appid: string): Promise<void>
      deleteGame(appid: string): Promise<void>
      listWantedGames(): Promise<WantedGame[]>
      addWantedGame(input: {
        appid: string
        name: string
        coverUrl?: string
      }): Promise<WantedAddResult>
      removeWantedGame(appid: string): Promise<void>
      searchSteamGames(query: string): Promise<SteamSearchResult[]>
      browseDllPath(): Promise<SteamApiDllInfo | null>
      browseSoundPath(): Promise<string | null>
      previewUnlockToast(): Promise<void>
      previewSessionRecap(): Promise<void>
      sessionRecapDone(): void
      applyGoldberg(request: GoldbergApplyRequest): Promise<void>
      browseGameInstallFolder(): Promise<string | null>
      listGameExecutables(installPath: string, gameName?: string): Promise<GameExecutable[]>
      resolveGameExecutables(
        appid: string,
        acceptedRoot?: string
      ): Promise<ResolveGameExecutablesResult>
      setGameLaunchConfig(request: SetGameLaunchConfigRequest): Promise<void>
      launchGame(appid: string): Promise<void>
      openPath(absolutePath: string | string[]): Promise<void>
      browseSteamlessFolder(): Promise<string | null>
      browseSteamlessExe(): Promise<string | null>
      runSteamless(exePath: string, appid?: string): Promise<SteamlessRunResult>
      browseLudusaviPath(): Promise<string | null>
      ludusaviCloudStatus(): Promise<{
        configured: boolean
        apiUrlHost: string | null
      }>
      setGameCloudSavesEnabled(
        appid: string,
        enabled: boolean
      ): Promise<{ ok: boolean; error?: string }>
      ludusaviCloudUploadGame(
        appid: string,
        backupId: string
      ): Promise<{ ok: boolean; error?: string }>
      ludusaviCloudListGame(appid: string): Promise<
        | {
            ok: true
            artifacts: Array<{
              id: string
              appid: string
              bytes: number
              sha256: string
              createdAt: string
            }>
          }
        | { ok: false; error: string }
      >
      ludusaviCloudDownloadGame(
        appid: string,
        artifactId?: string
      ): Promise<{ ok: boolean; error?: string; backupId?: string }>
      ludusaviCloudDownload(): Promise<{ ok: boolean; error?: string }>
      ludusaviBackupGame(appid: string): Promise<void>
      ludusaviListBackups(
        appid: string
      ): Promise<{ title: string; snapshots: LudusaviSnapshot[] } | string>
      ludusaviListCustomPaths(
        appid: string
      ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }>
      ludusaviAddCustomPath(
        appid: string,
        folder: string
      ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }>
      ludusaviRemoveCustomPath(
        appid: string,
        folder: string
      ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }>
      ludusaviRestoreGame(appid: string, backupId: string): Promise<void>
      ludusaviBackupLibrary(): Promise<void>
      ludusaviGetQueue(): Promise<{ runningAppid: string | null; pending: string[] }>
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
      scanInstalledGames(
        roots?: string[],
        options?: { includeIgnored?: boolean }
      ): Promise<ScannedInstallCandidate[]>
      importScannedInstall(
        request: ImportScannedInstallRequest
      ): Promise<{ created: boolean }>
      proposeInstallScanRoots(): Promise<string[]>
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
      checkForUpdates(): Promise<AppUpdateState>
      installUpdate(): Promise<void>
      getUpdateState(): Promise<AppUpdateState>
      onUpdateStateChanged(cb: (payload: AppUpdateState) => void): void
      offUpdateStateChanged(cb: (payload: AppUpdateState) => void): void
      getPendingChangelog(): Promise<PendingChangelog | null>
      onShowChangelog(cb: (payload: PendingChangelog) => void): void
      offShowChangelog(cb: (payload: PendingChangelog) => void): void
    }
  }
}

export {}
