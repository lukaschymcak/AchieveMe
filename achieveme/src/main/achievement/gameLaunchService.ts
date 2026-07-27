import path from 'node:path'
import fs from 'node:fs'
import type Database from 'better-sqlite3'
import type { SetGameLaunchConfigRequest } from '../../shared/types'
import {
  getGame,
  updateGameInstallPath,
  updateGameLaunchExe
} from '../db/repository'
import {
  LAUNCH_NEEDS_EXE,
  launchGameExe,
  listExeBaseNamesForPlaytime,
  listInstallExecutables
} from './gameLaunchUtils'

export {
  LAUNCH_NEEDS_EXE,
  launchGameExe,
  listExeBaseNamesForPlaytime,
  listInstallExecutables
}

/**
 * Updates install and/or launch paths for a game.
 *
 * @param db - Open SQLite database.
 * @param request - AppID and paths to persist.
 */
export function setGameLaunchConfig(
  db: Database.Database,
  request: SetGameLaunchConfigRequest
): void {
  const { appid, installPath, launchExe } = request
  if (installPath !== undefined && installPath.trim()) {
    updateGameInstallPath(db, appid, path.resolve(installPath.trim()))
  }
  updateGameLaunchExe(db, appid, launchExe.trim() ? path.resolve(launchExe.trim()) : '')
}

/**
 * Launches the game using its saved `launch_exe`, or signals that a pick is needed.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @throws Error with `code === LAUNCH_NEEDS_EXE` when no valid exe is configured.
 */
export function launchGame(db: Database.Database, appid: string): void {
  const game = getGame(db, appid)
  if (!game) {
    throw new Error(`Game not found: ${appid}`)
  }

  const launchExe = game.launch_exe?.trim() ?? ''
  if (!launchExe || !fs.existsSync(launchExe) || !fs.statSync(launchExe).isFile()) {
    const err = new Error('Select a game executable to play.') as Error & { code: string }
    err.code = LAUNCH_NEEDS_EXE
    throw err
  }

  launchGameExe(launchExe)
}
