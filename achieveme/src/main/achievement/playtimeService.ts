import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/database'
import { getAllGames, updateGamePlaytime } from '../db/repository'
import { loadSettings } from '../settings'
import { notifyLibraryUpdated } from './libraryNotifyService'
import { regenerateProfileStats } from './profileStatsService'

const POLL_INTERVAL_MS = 15_000
const exeCache = new Map<string, string[]>()
const activeSessions = new Map<string, number>()

let timer: NodeJS.Timeout | null = null

function listExeNames(installPath: string): string[] {
  const key = installPath.toLowerCase()
  const cached = exeCache.get(key)
  if (cached) return cached

  const names: string[] = []
  try {
    for (const entry of fs.readdirSync(installPath, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        names.push(path.parse(entry.name).name.toLowerCase())
      }
    }
  } catch {
    exeCache.set(key, [])
    return []
  }

  exeCache.set(key, names)
  return names
}

function getRunningProcessNames(): Set<string> {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Process | Select-Object -ExpandProperty Name"',
      { encoding: 'utf8', windowsHide: true }
    )
    return new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean)
    )
  } catch {
    return new Set()
  }
}

function tick(): void {
  const settings = loadSettings()
  if (!settings.playtimeTrackingEnabled) return

  const db = getDb()
  const running = getRunningProcessNames()
  const games = getAllGames(db)
  let changed = false

  for (const game of games) {
    const installPath = game.install_path?.trim()
    if (!installPath) continue

    const exeNames = listExeNames(installPath)
    if (exeNames.length === 0) continue

    const isRunning = exeNames.some((name) => running.has(name))
    const sessionStart = activeSessions.get(game.appid)

    if (isRunning) {
      if (sessionStart === undefined) {
        activeSessions.set(game.appid, Date.now())
      }
      continue
    }

    if (sessionStart === undefined) continue

    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - sessionStart) / 1000))
    activeSessions.delete(game.appid)
    updateGamePlaytime(db, game.appid, game.playtime_seconds + elapsedSeconds)
    changed = true
  }

  if (changed) {
    regenerateProfileStats(db)
    notifyLibraryUpdated()
  }
}

export function startPlaytimeTracker(): void {
  if (timer) return
  timer = setInterval(tick, POLL_INTERVAL_MS)
}

export function stopPlaytimeTracker(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  activeSessions.clear()
}

/** @internal test helper */
export function resetPlaytimeTrackerForTest(): void {
  stopPlaytimeTracker()
  exeCache.clear()
}
