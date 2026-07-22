import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult, SteamSearchResult, GoldbergApplyRequest, SteamApiDllInfo, LibraryUpdatedPayload } from '../../shared/types'

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
      applyGoldberg(request: GoldbergApplyRequest): Promise<void>
      onGoldbergLog(cb: (line: string) => void): void
      offGoldbergLog(): void
      onLibraryUpdated(cb: (payload: LibraryUpdatedPayload) => void): void
      offLibraryUpdated(cb: (payload: LibraryUpdatedPayload) => void): void
      onNavigateToGame(cb: (appid: string) => void): void
      offNavigateToGame(cb: (appid: string) => void): void
    }
  }
}

export {}
