/**
 * Pure playtime session matching and flush policy helpers.
 */

import {
  exeBasenameNoExt,
  isIgnoredPlaytimeExe,
  isIgnoredPlaytimeName,
  isPathUnderRoot,
  pathsEqual,
  processImageName,
  type ProcessInfo
} from './processListUtils.ts'

export const PLAYTIME_FLUSH_INTERVAL_MS = 30_000
/** Keep a Play session alive while the launcher hands off to the real exe. */
export const LAUNCH_GRACE_MS = 45_000

export type PlaytimeGameCandidate = {
  readonly appid: string
  readonly launchExe: string
  readonly scanRoot: string
  readonly extraBasenames?: readonly string[]
}

export type LaunchedPidMap = ReadonlyMap<string, number>

/** Result of one OS process-list fetch. */
export type ProcessListFetchResult = {
  readonly ok: boolean
  readonly processes: readonly ProcessInfo[]
  readonly error?: string
}

/** Process list actually used for a playtime tick. */
export type SelectedProcessList = {
  readonly processes: ProcessInfo[]
  readonly reusedLastGood: boolean
}

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
 * Prefers a successful non-empty fetch. On failure or an empty list, keeps the
 * last good snapshot so a timeout cannot look like every game exited.
 *
 * @param fetch - Latest OS process-list result
 * @param lastGood - Previous successful non-empty list
 */
export const selectProcessListForTick = (
  fetch: ProcessListFetchResult,
  lastGood: readonly ProcessInfo[]
): SelectedProcessList => {
  if (fetch.ok && fetch.processes.length > 0) {
    return { processes: [...fetch.processes], reusedLastGood: false }
  }
  if (lastGood.length > 0) {
    return { processes: [...lastGood], reusedLastGood: true }
  }
  return {
    processes: fetch.ok ? [...fetch.processes] : [],
    reusedLastGood: false
  }
}

/**
 * Adds synthetic rows for Play PIDs that are still alive but missing from the OS snapshot.
 *
 * @param processes - Enumerated processes
 * @param launchedPids - appid → pid from Play
 * @param alivePids - PIDs confirmed alive (e.g. `process.kill(pid, 0)`)
 */
export const overlayAliveLaunchedPids = (
  processes: readonly ProcessInfo[],
  launchedPids: LaunchedPidMap,
  alivePids: ReadonlySet<number>
): ProcessInfo[] => {
  const known = new Set(processes.map((p) => p.pid))
  const next = [...processes]
  for (const pid of launchedPids.values()) {
    if (!alivePids.has(pid) || known.has(pid)) continue
    known.add(pid)
    next.push({ pid, name: '', executablePath: '' })
  }
  return next
}

/**
 * True when an unmatched Play session should stay open while the real exe starts.
 *
 * @param launchedAtMs - Session/Play start epoch ms, or undefined when not a Play launch
 * @param nowMs - Current epoch ms
 * @param graceMs - Grace window
 */
export const shouldDeferSessionEnd = (
  launchedAtMs: number | undefined,
  nowMs: number,
  graceMs: number = LAUNCH_GRACE_MS
): boolean => {
  if (launchedAtMs === undefined) return false
  return nowMs - launchedAtMs < graceMs
}

/**
 * Launch exe plus extra install-folder image names, ignoring tools/crash handlers.
 */
function candidateImageNames(game: PlaytimeGameCandidate): Set<string> {
  const names = new Set<string>()
  const add = (raw: string): void => {
    const name = exeBasenameNoExt(raw)
    if (!name || isIgnoredPlaytimeName(name)) return
    names.add(name)
  }
  add(game.launchExe)
  for (const extra of game.extraBasenames ?? []) add(extra)
  return names
}

/**
 * Hydra-style image-name match; require path agreement when Windows exposes a path.
 */
function nameMatchesGame(process: ProcessInfo, game: PlaytimeGameCandidate): boolean {
  const image = processImageName(process)
  if (!image || isIgnoredPlaytimeName(image)) return false
  if (!candidateImageNames(game).has(image)) return false

  const exePath = process.executablePath.trim()
  if (!exePath) return true

  const launchExe = game.launchExe.trim()
  if (launchExe && pathsEqual(exePath, launchExe)) return true
  const root = game.scanRoot.trim()
  if (root && isPathUnderRoot(exePath, root)) return true
  return exeBasenameNoExt(exePath) === image
}

/**
 * Finds a process for one game: Play PID, launch path, install root, then Hydra-style
 * image name (including hidden-path processes and extra install exes).
 *
 * @param game - Library candidate
 * @param processes - Running processes
 * @param launchedPids - Optional appid → pid from launch
 * @param claimedPids - PIDs already assigned this tick
 */
const findProcessForGame = (
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

  const launchExe = game.launchExe.trim()
  if (launchExe) {
    const byLaunch = processes.find(
      (p) => !claimedPids.has(p.pid) && pathsEqual(p.executablePath, launchExe)
    )
    if (byLaunch) return byLaunch
  }

  const root = game.scanRoot.trim()
  if (root) {
    const byRoot = processes.find(
      (p) =>
        !claimedPids.has(p.pid) &&
        Boolean(p.executablePath.trim()) &&
        !isIgnoredPlaytimeExe(p.executablePath) &&
        isPathUnderRoot(p.executablePath, root)
    )
    if (byRoot) return byRoot
  }

  const byName = processes.find(
    (p) => !claimedPids.has(p.pid) && nameMatchesGame(p, game)
  )
  return byName ?? null
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
