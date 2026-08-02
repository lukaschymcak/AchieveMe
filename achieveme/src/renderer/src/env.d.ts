import type {
  ProfileStats,
  GameSummary,
  GameDetail,
  AppSettings,
  ImportResult,
  SteamSearchResult,
  GoldbergApplyRequest,
  SteamApiDllInfo,
  LibraryUpdatedPayload,
  SessionRecapPayload,
  GameExecutable,
  ResolveGameExecutablesResult,
  SetGameLaunchConfigRequest,
  SteamlessRunResult
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
      exportZip(): Promise<void>
      importZip(): Promise<ImportResult | null>
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
