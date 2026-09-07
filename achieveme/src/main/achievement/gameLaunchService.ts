import path from 'node:path'
import fs from 'node:fs'
import { shell } from 'electron'
import type Database from 'better-sqlite3'
import type { ResolveGameExecutablesResult, SetGameLaunchConfigRequest } from '../../shared/types'
import { tokenizeLaunchArgs } from '../../shared/gameExecutableRanking.ts'
import {
  getGame,
  updateGameInstallPath,
  updateGameLaunchArgs,
  updateGameLaunchExe
} from '../db/repository'
import { registerLaunchedPid } from './playtimeService'
import {
  LAUNCH_NEEDS_EXE,
  launchGameExe,
  listExeBaseNamesForPlaytime,
  listInstallExecutables,
  resolveGameRoot
} from './gameLaunchUtils'

export {
  LAUNCH_NEEDS_EXE,
  launchGameExe,
  listExeBaseNamesForPlaytime,
  listInstallExecutables,
  resolveGameRoot
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
  const { appid, installPath, launchExe, launchArgs } = request
  if (installPath !== undefined && installPath.trim()) {
    updateGameInstallPath(db, appid, path.resolve(installPath.trim()))
  }
  updateGameLaunchExe(db, appid, launchExe.trim() ? path.resolve(launchExe.trim()) : '')
  if (launchArgs !== undefined) {
    updateGameLaunchArgs(db, appid, launchArgs)
  }
}

/**
 * Climbs from the stored install/DLL path toward the game-named folder, then lists `.exe`s.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param acceptedRoot - Absolute folder the user confirmed (skips name matching).
 */
export function resolveGameExecutables(
  db: Database.Database,
  appid: string,
  acceptedRoot?: string
): ResolveGameExecutablesResult {
  const game = getGame(db, appid)
  if (!game) {
    throw new Error(`Game not found: ${appid}`)
  }

  if (acceptedRoot?.trim()) {
    const root = path.resolve(acceptedRoot.trim())
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return { status: 'need_browse' }
    }
    return {
      status: 'ready',
      root,
      executables: listInstallExecutables(root, game.name)
    }
  }

  const installPath = game.install_path?.trim() ?? ''
  if (!installPath || !fs.existsSync(installPath) || !fs.statSync(installPath).isDirectory()) {
    return { status: 'need_browse' }
  }

  const resolved = resolveGameRoot(installPath, game.name)
  if (resolved.status === 'confident') {
    return {
      status: 'ready',
      root: resolved.root,
      executables: listInstallExecutables(resolved.root, game.name)
    }
  }
  if (resolved.status === 'unsure') {
    return { status: 'confirm_root', candidatePath: resolved.candidatePath }
  }
  return { status: 'need_browse' }
}

/**
 * Launches the game using its saved `launch_exe` and `launch_args`, or signals that a pick is needed.
 * Prefers spawn (PID → playtime). Falls back to ShellExecute on EACCES.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @throws Error with `code === LAUNCH_NEEDS_EXE` when no valid exe is configured.
 */
export async function launchGame(db: Database.Database, appid: string): Promise<void> {
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

  const args = tokenizeLaunchArgs(game.launch_args ?? '')
  const result = await launchGameExe(launchExe, {
    args,
    openPath: (filePath) => shell.openPath(filePath)
  })
  if (result.pid != null) {
    registerLaunchedPid(appid, result.pid)
  }
}
