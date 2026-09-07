import type { BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import {
  getAllGames,
  getGamesWithOpenPlaytimeSession,
  updateGamePlaytime,
  updateGamePlaytimeSession
} from '../db/repository'
import { loadSettings } from '../settings'
import { resolveGameRoot } from './gameLaunchUtils'
import { listRunningProcesses } from './processWatcherService'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { regenerateProfileStats } from './profileStatsService'
import { offerSessionRecapIfNeeded } from './sessionRecapService'
import { scheduleGameBackup } from './ludusaviBackupQueue'
import type { ProcessInfo } from '../../shared/processListUtils'
import {
  flushDeltaSeconds,
  matchRunningGames,
  shouldPeriodicFlush,
  type PlaytimeGameCandidate
} from '../../shared/playtimeSessionUtils'

const POLL_INTERVAL_MS = 2_000

type ActiveSession = {
  sessionStartMs: number
  lastFlushMs: number
  matchedPid?: number
}

const activeSessions = new Map<string, ActiveSession>()
const launchedPids = new Map<string, number>()

let timer: NodeJS.Timeout | null = null
let resolveMainWindow: (() => BrowserWindow | null) | null = null
let didHideForPlay = false
let recoveryDone = false

/**
 * Registers the main-window resolver used for hide-on-play.
 *
 * @param resolver - Returns the main BrowserWindow, or null
 */
export function setPlaytimeMainWindow(resolver: () => BrowserWindow | null): void {
  resolveMainWindow = resolver
}

/**
 * Records a PID spawned for a game (Workstream B will call this after launch).
 *
 * @param appid - Steam AppID
 * @param pid - Process id from spawn
 */
export function registerLaunchedPid(appid: string, pid: number): void {
  if (!appid.trim() || !Number.isInteger(pid) || pid <= 0) return
  launchedPids.set(appid.trim(), pid)
}

/**
 * Clears a previously registered launch PID.
 *
 * @param appid - Steam AppID
 */
export function clearLaunchedPid(appid: string): void {
  launchedPids.delete(appid.trim())
}

function scanRootForGame(installPath: string, gameName: string): string {
  const install = installPath.trim()
  if (!install) return ''
  const resolved = resolveGameRoot(install, gameName)
  if (resolved.status === 'confident') return resolved.root
  if (resolved.status === 'unsure') return resolved.candidatePath
  return install
}

function buildCandidates(): PlaytimeGameCandidate[] {
  const db = getDb()
  return getAllGames(db)
    .filter((g) => g.install_path?.trim() || g.launch_exe?.trim())
    .map((g) => ({
      appid: g.appid,
      launchExe: g.launch_exe?.trim() ?? '',
      scanRoot: scanRootForGame(g.install_path?.trim() ?? '', g.name)
    }))
}

function hideMainIfNeeded(): void {
  const settings = loadSettings()
  if (!settings.hideToTrayOnGameStart) return
  const win = resolveMainWindow?.() ?? null
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) return
  win.hide()
  didHideForPlay = true
}

function restoreMainIfHiddenForPlay(): void {
  if (!didHideForPlay) return
  didHideForPlay = false
  const win = resolveMainWindow?.() ?? null
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
}

function persistSessionColumns(appid: string, startedAt: number, lastFlushAt: number): void {
  updateGamePlaytimeSession(getDb(), appid, { startedAt, lastFlushAt })
}

function flushSession(
  appid: string,
  session: ActiveSession,
  nowMs: number,
  playtimeSeconds: number
): number {
  const delta = flushDeltaSeconds(session.lastFlushMs, nowMs)
  if (delta <= 0) return playtimeSeconds
  const next = playtimeSeconds + delta
  updateGamePlaytime(getDb(), appid, next)
  session.lastFlushMs = nowMs
  persistSessionColumns(appid, session.sessionStartMs, nowMs)
  return next
}

function endLiveSession(appid: string, session: ActiveSession, nowMs: number): void {
  const db = getDb()
  const game = getAllGames(db).find((g) => g.appid === appid)
  const playtime = game?.playtime_seconds ?? 0
  flushSession(appid, session, nowMs, playtime)
  persistSessionColumns(appid, 0, 0)
  activeSessions.delete(appid)
  clearLaunchedPid(appid)
  offerSessionRecapIfNeeded(appid, session.sessionStartMs, nowMs)
  scheduleGameBackup(appid, 'session')
}

function startSession(appid: string, nowMs: number, process: ProcessInfo): void {
  const session: ActiveSession = {
    sessionStartMs: nowMs,
    lastFlushMs: nowMs,
    matchedPid: process.pid
  }
  activeSessions.set(appid, session)
  persistSessionColumns(appid, nowMs, nowMs)
  if (activeSessions.size === 1) {
    hideMainIfNeeded()
  }
}

/**
 * Runs one detection tick against an injected process list (tests / main loop).
 *
 * @param processes - Running processes
 * @param nowMs - Current epoch ms
 */
export function tickWithProcesses(processes: ProcessInfo[], nowMs: number = Date.now()): void {
  const settings = loadSettings()
  if (!settings.playtimeTrackingEnabled) return

  const db = getDb()
  const candidates = buildCandidates()
  const matched = matchRunningGames(processes, candidates, launchedPids)
  let libraryDirty = false

  for (const [appid, process] of matched) {
    const existing = activeSessions.get(appid)
    if (!existing) {
      startSession(appid, nowMs, process)
      libraryDirty = true
      continue
    }
    existing.matchedPid = process.pid
    if (shouldPeriodicFlush(existing.lastFlushMs, nowMs)) {
      const game = getAllGames(db).find((g) => g.appid === appid)
      flushSession(appid, existing, nowMs, game?.playtime_seconds ?? 0)
      libraryDirty = true
    }
  }

  for (const [appid, session] of [...activeSessions.entries()]) {
    if (matched.has(appid)) continue
    endLiveSession(appid, session, nowMs)
    libraryDirty = true
  }

  if (activeSessions.size === 0) {
    restoreMainIfHiddenForPlay()
  }

  if (libraryDirty) {
    regenerateProfileStats(db)
    notifyLibraryUpdated()
  }
}

function recoverOpenSessionsFromDb(): void {
  if (recoveryDone) return
  recoveryDone = true

  const settings = loadSettings()
  if (!settings.playtimeTrackingEnabled) return

  const db = getDb()
  const openRows = getGamesWithOpenPlaytimeSession(db)
  if (openRows.length === 0) return

  const processes = listRunningProcesses()
  const candidates = buildCandidates()
  const matched = matchRunningGames(processes, candidates, launchedPids)
  let libraryDirty = false

  for (const row of openRows) {
    const process = matched.get(row.appid)
    if (process) {
      activeSessions.set(row.appid, {
        sessionStartMs: row.playtime_session_started_at,
        lastFlushMs: row.playtime_last_flush_at || row.playtime_session_started_at,
        matchedPid: process.pid
      })
      continue
    }
    // Orphan: process gone — clear session columns, no extra seconds, no recap.
    persistSessionColumns(row.appid, 0, 0)
    clearLaunchedPid(row.appid)
    libraryDirty = true
  }

  if (libraryDirty) {
    regenerateProfileStats(db)
    notifyLibraryUpdated()
  }
}

function tick(): void {
  tickWithProcesses(listRunningProcesses(), Date.now())
}

/**
 * Starts the 2s playtime watcher (idempotent).
 */
export function startPlaytimeTracker(): void {
  recoverOpenSessionsFromDb()
  if (timer) return
  timer = setInterval(tick, POLL_INTERVAL_MS)
}

/**
 * Flushes live sessions (with recap when eligible), then stops the watcher.
 */
export function stopPlaytimeTracker(): void {
  const nowMs = Date.now()
  const open = [...activeSessions.entries()]
  for (const [appid, session] of open) {
    endLiveSession(appid, session, nowMs)
  }
  if (open.length > 0) {
    regenerateProfileStats(getDb())
    notifyLibraryUpdated()
  }
  restoreMainIfHiddenForPlay()

  if (timer) {
    clearInterval(timer)
    timer = null
  }
  activeSessions.clear()
}

/** @internal test helper */
export function resetPlaytimeTrackerForTest(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  activeSessions.clear()
  launchedPids.clear()
  didHideForPlay = false
  recoveryDone = false
  resolveMainWindow = null
}
