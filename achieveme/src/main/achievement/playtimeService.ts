import type { BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import {
  getAllGames,
  getGamesWithOpenPlaytimeSession,
  updateGamePlaytime,
  updateGamePlaytimeSession
} from '../db/repository'
import { loadSettings } from '../settings'
import { listExeBaseNamesForPlaytime, resolveGameRoot } from './gameLaunchUtils'
import { isPidAlive, listRunningProcesses } from './processWatcherService'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { regenerateProfileStats } from './profileStatsService'
import { offerSessionRecapIfNeeded } from './sessionRecapService'
import { scheduleGameBackup } from './ludusaviBackupQueue'
import type { ProcessInfo } from '../../shared/processListUtils'
import {
  flushDeltaSeconds,
  matchRunningGames,
  overlayAliveLaunchedPids,
  selectProcessListForTick,
  shouldDeferSessionEnd,
  shouldPeriodicFlush,
  LAUNCH_GRACE_MS,
  type PlaytimeGameCandidate
} from '../../shared/playtimeSessionUtils.ts'

const POLL_INTERVAL_MS = 2_000
const PROCESS_LIST_REUSE_LOG_EVERY = 15
const PLAYTIME_LOG_PREFIX = '[playtime]'

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
let stopped = true
let fetchingProcessList = false
let lastGoodProcesses: ProcessInfo[] = []
let consecutiveProcessListReuses = 0
const extraBasenameCache = new Map<string, { key: string; names: string[] }>()

function playtimeTimestamp(): string {
  const d = new Date()
  const time = d.toTimeString().split(' ')[0]
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${time}.${ms}`
}

function playtimeLog(event: string, detail?: Record<string, unknown>): void {
  const prefix = `[playtime ${playtimeTimestamp()}]`
  detail ? console.log(prefix, event, detail) : console.log(prefix, event)
}

function playtimeWarn(event: string, detail?: Record<string, unknown>): void {
  const prefix = `[playtime ${playtimeTimestamp()}]`
  detail ? console.warn(prefix, event, detail) : console.warn(prefix, event)
}

/**
 * Registers the main-window resolver used for hide-on-play.
 *
 * @param resolver - Returns the main BrowserWindow, or null
 */
export function setPlaytimeMainWindow(resolver: () => BrowserWindow | null): void {
  resolveMainWindow = resolver
}

/**
 * Records a PID spawned for a game so playtime can match it.
 *
 * @param appid - Steam AppID
 * @param pid - Process id from spawn
 */
export function registerLaunchedPid(appid: string, pid: number): void {
  if (!appid.trim() || !Number.isInteger(pid) || pid <= 0) return
  const id = appid.trim()
  launchedPids.set(id, pid)
  playtimeLog('launch.pid', { appid: id, pid })
  if (!loadSettings().playtimeTrackingEnabled) return
  if (activeSessions.has(id)) {
    const existing = activeSessions.get(id)
    if (existing) existing.matchedPid = pid
    return
  }
  startSession(id, Date.now(), { pid, name: '', executablePath: '' })
}

/**
 * Clears a previously registered launch PID.
 *
 * @param appid - Steam AppID
 */
function clearLaunchedPid(appid: string): void {
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

/**
 * Cached launch + install-folder exe names so a launcher can hand off to the game.
 */
function extraBasenamesForGame(
  appid: string,
  installPath: string,
  launchExe: string,
  gameName: string
): string[] {
  const key = `${installPath}|${launchExe}`
  const cached = extraBasenameCache.get(appid)
  if (cached && cached.key === key) return cached.names

  const names = new Set<string>()
  if (installPath) {
    try {
      for (const name of listExeBaseNamesForPlaytime(installPath, gameName)) {
        names.add(name)
      }
    } catch {
      // Missing folder — launch exe name still applies
    }
  }
  const list = [...names]
  extraBasenameCache.set(appid, { key, names: list })
  return list
}

function buildCandidates(): PlaytimeGameCandidate[] {
  const db = getDb()
  return getAllGames(db)
    .filter((g) => g.install_path?.trim() || g.launch_exe?.trim())
    .map((g) => {
      const launchExe = g.launch_exe?.trim() ?? ''
      const installPath = g.install_path?.trim() ?? ''
      return {
        appid: g.appid,
        launchExe,
        scanRoot: scanRootForGame(installPath, g.name),
        extraBasenames: extraBasenamesForGame(g.appid, installPath, launchExe, g.name)
      }
    })
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
  const win = resolveMainWindow?.() ?? null
  if (!win || win.isDestroyed()) return
  // Only restore the window if this service was the one that hid it.
  // Never un-minimize a window the user deliberately minimized.
  if (didHideForPlay) {
    didHideForPlay = false
    if (!win.isVisible()) win.show()
    if (win.isMinimized()) win.restore()
    win.focus()
  }
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
  playtimeLog('session.end', {
    appid,
    seconds: Math.max(1, Math.floor((nowMs - session.sessionStartMs) / 1000)),
    pid: session.matchedPid ?? null
  })
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
  playtimeLog('session.start', {
    appid,
    pid: process.pid,
    exe: process.executablePath || null
  })
  if (activeSessions.size === 1) {
    hideMainIfNeeded()
  }
}

/**
 * Runs one detection tick against a process snapshot.
 *
 * @param processes - Running processes
 * @param nowMs - Current epoch ms
 */
function tickWithProcesses(processes: ProcessInfo[], nowMs: number = Date.now()): void {
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
    const launchedAt = launchedPids.has(appid) ? session.sessionStartMs : undefined
    if (shouldDeferSessionEnd(launchedAt, nowMs)) {
      playtimeLog('session.defer-end', {
        appid,
        elapsedSinceLaunchMs: nowMs - (launchedAt ?? 0),
        graceRemainingMs: Math.max(0, LAUNCH_GRACE_MS - (nowMs - (launchedAt ?? 0)))
      })
      continue
    }
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

function recoverOpenSessionsFromDb(processes: ProcessInfo[]): void {
  if (recoveryDone) return
  recoveryDone = true

  const settings = loadSettings()
  if (!settings.playtimeTrackingEnabled) return

  const db = getDb()
  const openRows = getGamesWithOpenPlaytimeSession(db)
  if (openRows.length === 0) return

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
      playtimeLog('session.recover', { appid: row.appid, pid: process.pid })
      continue
    }
    // Orphan: process gone — clear session columns, no extra seconds, no recap.
    playtimeLog('session.orphan', { appid: row.appid })
    persistSessionColumns(row.appid, 0, 0)
    clearLaunchedPid(row.appid)
    libraryDirty = true
  }

  if (libraryDirty) {
    regenerateProfileStats(db)
    notifyLibraryUpdated()
  }
}

/** PIDs from Play that still exist according to the OS. */
function collectAliveLaunchedPids(): Set<number> {
  const alive = new Set<number>()
  for (const pid of launchedPids.values()) {
    if (isPidAlive(pid)) alive.add(pid)
  }
  return alive
}

/** Runs a tick with live Play PIDs overlaid onto the latest snapshot. */
function tickWithLaunchedOverlay(processes: ProcessInfo[], nowMs: number = Date.now()): void {
  tickWithProcesses(
    overlayAliveLaunchedPids(processes, launchedPids, collectAliveLaunchedPids()),
    nowMs
  )
}

async function runTick(): Promise<void> {
  if (stopped) return
  tickWithLaunchedOverlay(lastGoodProcesses)

  if (fetchingProcessList) return
  fetchingProcessList = true
  try {
    const t0 = Date.now()
    const fetch = await listRunningProcesses()
    const scanMs = Date.now() - t0
    if (activeSessions.size > 0 && scanMs > 1000) {
      playtimeLog('process-scan.slow', { scanMs, count: fetch.processes.length })
    }
    if (stopped) return
    const selected = selectProcessListForTick(fetch, lastGoodProcesses)
    if (selected.reusedLastGood) {
      consecutiveProcessListReuses += 1
      if (
        consecutiveProcessListReuses === 1 ||
        consecutiveProcessListReuses % PROCESS_LIST_REUSE_LOG_EVERY === 0
      ) {
        playtimeWarn('process-list.reuse', {
          ok: fetch.ok,
          error: fetch.error ?? null,
          fetched: fetch.processes.length,
          lastGood: lastGoodProcesses.length,
          consecutiveReuses: consecutiveProcessListReuses
        })
      }
    } else {
      if (consecutiveProcessListReuses > 0) {
        playtimeLog('process-list.recovered', { count: selected.processes.length })
      }
      consecutiveProcessListReuses = 0
      lastGoodProcesses = selected.processes
    }

    recoverOpenSessionsFromDb(selected.processes)
    if (stopped) return
    tickWithLaunchedOverlay(selected.processes)
  } catch (err) {
    playtimeWarn('tick.failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  } finally {
    fetchingProcessList = false
  }
}

/**
 * Starts the 2s playtime watcher (idempotent). First tick runs immediately.
 */
export function startPlaytimeTracker(): void {
  stopped = false
  if (timer) return
  timer = setInterval(() => {
    void runTick()
  }, POLL_INTERVAL_MS)
  void runTick()
}

/**
 * Flushes live sessions (with recap when eligible), then stops the watcher.
 */
export function stopPlaytimeTracker(): void {
  stopped = true
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
