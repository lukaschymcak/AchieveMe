import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/database'
import { saveGameToolApply } from '../db/repository'
import {
  LAUNCH_NEEDS_EXE,
  launchGame,
  listInstallExecutables,
  resolveGameExecutables,
  setGameLaunchConfig
} from '../achievement/gameLaunchService'
import { runSteamlessUnpack } from '../achievement/steamlessService'
import { applyGoldberg } from '../achievement/goldbergSetupService'
import { loadSettings } from '../settings'
import type {
  AppSettings,
  GoldbergApplyRequest,
  SteamApiDllInfo,
  GameExecutable,
  ResolveGameExecutablesResult,
  SetGameLaunchConfigRequest,
  SteamlessRunResult
} from '../../shared/types'

export function registerGameLaunchHandlers(): void {
  ipcMain.handle('launch-game', async (_event, appid: string): Promise<void> => {
    try {
      await launchGame(getDb(), appid)
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      if (code === LAUNCH_NEEDS_EXE) {
        throw new Error(`${LAUNCH_NEEDS_EXE}: Select a game executable to play.`)
      }
      throw err
    }
  })

  ipcMain.handle(
    'list-game-executables',
    (_event, installPath: string, gameName?: string): GameExecutable[] =>
      listInstallExecutables(installPath, gameName)
  )

  ipcMain.handle(
    'resolve-game-executables',
    (_event, appid: string, acceptedRoot?: string): ResolveGameExecutablesResult =>
      resolveGameExecutables(getDb(), appid, acceptedRoot)
  )

  ipcMain.handle(
    'set-game-launch-config',
    (_event, request: SetGameLaunchConfigRequest): void => setGameLaunchConfig(getDb(), request)
  )

  ipcMain.handle('browse-dll-path', async (): Promise<SteamApiDllInfo | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select steam_api.dll or steam_api64.dll',
      filters: [{ name: 'Steam API DLL', extensions: ['dll'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const dllPath = path.resolve(filePaths[0])
    const fileName = path.basename(dllPath)
    const lower = fileName.toLowerCase()
    if (lower !== 'steam_api.dll' && lower !== 'steam_api64.dll') {
      throw new Error('Select steam_api.dll or steam_api64.dll.')
    }
    if (!fs.existsSync(dllPath)) throw new Error('Steam API DLL was not found.')

    return {
      path: dllPath,
      fileName,
      directory: path.dirname(dllPath),
      architecture: lower === 'steam_api64.dll' ? 'x64' : 'x86'
    }
  })

  ipcMain.handle('apply-goldberg', async (event, request: GoldbergApplyRequest): Promise<void> => {
    const settings = loadSettings()
    await applyGoldberg(request, settings, (line) => {
      event.sender.send('goldberg-log', line)
    })
  })

  ipcMain.handle('browse-steamless-exe', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select executable to unpack with Steamless',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return path.resolve(filePaths[0])
  })

  ipcMain.handle(
    'run-steamless',
    async (event, exePath: string, appid?: string): Promise<SteamlessRunResult> => {
      const settings = loadSettings() as AppSettings
      const folder = settings.steamlessFolder?.trim() ?? ''
      if (!folder) throw new Error('Set the Steamless folder in Settings first.')
      const result = await runSteamlessUnpack(folder, exePath, (line) => {
        event.sender.send('steamless-log', line)
      })
      const cleanAppid = String(appid || '').trim()
      if (result.ok && /^\d+$/.test(cleanAppid)) {
        saveGameToolApply(getDb(), cleanAppid, {
          steamlessApplied: true,
          steamlessExe: path.resolve(exePath)
        })
      }
      return result
    }
  )
}
