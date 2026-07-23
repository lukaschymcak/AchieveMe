import type { BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { getAchievementsForGame, getAllGames, getGame } from '../db/repository'
import { loadSettings } from '../settings'
import type { SessionRecapPayload } from '../../shared/types'
import {
  pickDemoSessionSeconds,
  pickDemoUnlocks,
  pickRandomGameIndex,
  shouldOfferSessionRecap,
  unlocksInSessionWindow,
  xpForSessionUnlocks
} from '../../shared/sessionRecapUtils'

let resolveMainWindow: (() => BrowserWindow | null) | null = null
let queue: SessionRecapPayload[] = []
let showing = false

export function setSessionRecapMainWindow(resolver: () => BrowserWindow | null): void {
  resolveMainWindow = resolver
}

function showAndFocusMain(): BrowserWindow | null {
  const win = resolveMainWindow?.() ?? null
  if (!win || win.isDestroyed()) return null
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
  return win
}

function pumpQueue(): void {
  if (showing || queue.length === 0) return
  const win = showAndFocusMain()
  if (!win) return

  const payload = queue.shift()!
  showing = true
  win.webContents.send('session-recap', payload)
}

export function acknowledgeSessionRecap(): void {
  showing = false
  pumpQueue()
}

export function buildSessionRecap(
  appid: string,
  sessionStartMs: number,
  sessionEndMs: number
): SessionRecapPayload | null {
  const db = getDb()
  const game = getGame(db, appid)
  if (!game) return null

  const durationSeconds = Math.max(
    1,
    Math.floor((sessionEndMs - sessionStartMs) / 1000)
  )
  const startSec = Math.floor(sessionStartMs / 1000)
  const endSec = Math.floor(sessionEndMs / 1000)
  const unlocks = unlocksInSessionWindow(
    getAchievementsForGame(db, appid),
    startSec,
    endSec
  )

  return {
    appid,
    gameName: game.name,
    durationSeconds,
    xpGained: xpForSessionUnlocks(unlocks),
    unlocks
  }
}

/** Called when a tracked play session ends. */
export function offerSessionRecapIfNeeded(
  appid: string,
  sessionStartMs: number,
  sessionEndMs: number
): void {
  const settings = loadSettings()
  if (!settings.sessionRecapEnabled) return

  const elapsedSeconds = Math.max(
    1,
    Math.floor((sessionEndMs - sessionStartMs) / 1000)
  )
  if (!shouldOfferSessionRecap(elapsedSeconds)) return

  const payload = buildSessionRecap(appid, sessionStartMs, sessionEndMs)
  if (!payload) return

  queue.push(payload)
  pumpQueue()
}

/** Settings test button — random library game, demo duration/unlocks. */
export function previewSessionRecap(): void {
  const db = getDb()
  const games = getAllGames(db)
  const index = pickRandomGameIndex(games.length)
  if (index < 0) return

  const game = games[index]!
  const unlocks = pickDemoUnlocks(getAchievementsForGame(db, game.appid), 3)
  const payload: SessionRecapPayload = {
    appid: game.appid,
    gameName: game.name,
    durationSeconds: pickDemoSessionSeconds(),
    xpGained: xpForSessionUnlocks(unlocks),
    unlocks
  }

  queue = [payload]
  showing = false
  pumpQueue()
}

/** @internal */
export function resetSessionRecapForTest(): void {
  queue = []
  showing = false
}
