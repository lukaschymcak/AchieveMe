import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult } from '../../shared/types'

declare global {
  interface Window {
    api: {
      getProfileStats(): Promise<ProfileStats | null>
      getAllGames(): Promise<GameSummary[]>
      getGameDetail(appid: string): Promise<GameDetail | null>
      getSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<void>
      refresh(): Promise<void>
      exportJson(): Promise<void>
      importJson(): Promise<ImportResult | null>
    }
  }
}

export {}
