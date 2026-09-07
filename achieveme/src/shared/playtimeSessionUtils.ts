/**
 * Pure playtime session matching and flush policy helpers.
 */

import {
  isIgnoredPlaytimeExe,
  isPathUnderRoot,
  pathsEqual,
  type ProcessInfo
} from './processListUtils.ts'

export const PLAYTIME_FLUSH_INTERVAL_MS = 30_000

export type PlaytimeGameCandidate = {
  readonly appid: string
  readonly launchExe: string
  readonly scanRoot: string
}

export type LaunchedPidMap = ReadonlyMap<string, number>

/**
 * Seconds to add for a flush interval. Floor to whole seconds; never negative.
 *
 * @param lastFlushMs - Last flush epoch ms
 * @param nowMs - Current epoch ms
 */
export const flushDeltaSeconds = (lastFlushMs: number, nowMs: number): number => {
  if (nowMs <= lastFlushMs) return 0
  return Math.floor((nowMs - lastFlushMs) / 1000)
}

/**
 * True when enough wall time has passed since last flush for a periodic write.
 *
 * @param lastFlushMs - Last flush epoch ms
 * @param nowMs - Current epoch ms
 * @param intervalMs - Flush interval (default 30s)
 */
export const shouldPeriodicFlush = (
  lastFlushMs: number,
  nowMs: number,
  intervalMs: number = PLAYTIME_FLUSH_INTERVAL_MS
): boolean => nowMs - lastFlushMs >= intervalMs

/**
 * Finds a process for one game: registered PID, then launch_exe path, then under-root.
 *
 * @param game - Library candidate
 * @param processes - Running processes
 * @param launchedPids - Optional appid → pid from launch
 * @param claimedPids - PIDs already assigned this tick
 */
export const findProcessForGame = (
  game: PlaytimeGameCandidate,
  processes: readonly ProcessInfo[],
  launchedPids: LaunchedPidMap,
  claimedPids: ReadonlySet<number>
): ProcessInfo | null => {
  const registered = launchedPids.get(game.appid)
  if (registered !== undefined) {
    const byPid = processes.find((p) => p.pid === registered && !claimedPids.has(p.pid))
    if (byPid) return byPid
  }

  if (game.launchExe.trim()) {
    const byLaunch = processes.find(
      (p) => !claimedPids.has(p.pid) && pathsEqual(p.executablePath, game.launchExe)
    )
    if (byLaunch) return byLaunch
  }

  const root = game.scanRoot.trim()
  if (!root) return null

  const byRoot = processes.find(
    (p) =>
      !claimedPids.has(p.pid) &&
      !isIgnoredPlaytimeExe(p.executablePath) &&
      isPathUnderRoot(p.executablePath, root)
  )
  return byRoot ?? null
}

/**
 * Builds appid → matched process for this tick. Games are matched in order;
 * one process cannot claim two games.
 *
 * @param processes - Running processes
 * @param games - Library candidates in stable order
 * @param launchedPids - Optional appid → pid from launch
 */
export const matchRunningGames = (
  processes: readonly ProcessInfo[],
  games: readonly PlaytimeGameCandidate[],
  launchedPids: LaunchedPidMap = new Map()
): Map<string, ProcessInfo> => {
  const matched = new Map<string, ProcessInfo>()
  const claimedPids = new Set<number>()

  for (const game of games) {
    const process = findProcessForGame(game, processes, launchedPids, claimedPids)
    if (!process) continue
    matched.set(game.appid, process)
    claimedPids.add(process.pid)
  }

  return matched
}

/**
 * Whether an orphaned DB session close should offer a session recap.
 * Always false — only live session ends observed by this process may recap.
 */
export const shouldOfferRecapOnOrphanClose = (): boolean => false
