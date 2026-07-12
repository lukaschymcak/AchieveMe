import { contextBridge, ipcRenderer } from 'electron'
import type { ProfileStats, GameSummary, GameDetail, AppSettings, ImportResult } from '../shared/types'

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

  exportJson: (): Promise<void> =>
    ipcRenderer.invoke('export-json'),

  importJson: (): Promise<ImportResult | null> =>
    ipcRenderer.invoke('import-json'),

  exportZip: (): Promise<void> =>
    ipcRenderer.invoke('export-zip'),

  importZip: (): Promise<ImportResult | null> =>
    ipcRenderer.invoke('import-zip')
})
