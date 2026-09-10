import type { BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { getAchievementsForGame, getAllGames, getGame } from '../db/repository'
import { loadSettings } from '../settings'
import type { SessionRecapPayload } from '../../shared/types'
import { cacheIconUrlFromSteamValue } from '../../shared/imageCacheUrls'
import {
  pickDemoSessionSeconds,
  pickDemoUnlocks,
  pickRandomGameIndex,
  SESSION_RECAP_MIN_SECONDS,
  shouldOfferSessionRecap,
  unlocksInSessionWindow,
  xpForSessionUnlocks
} from '../../shared/sessionRecapUtils'

function toCacheIconUnlocks<T extends { iconUrl: string }>(
  appid: string,
  unlocks: T[]
): T[] {
  return unlocks.map((u) => ({
    ...u,
    iconUrl: cacheIconUrlFromSteamValue(appid, u.iconUrl)
  }))
}

let resolveMainWindow: (() => BrowserWindow | null) | null = null
let queue: SessionRecapPayload[] = []
let showing = false
let windowWaitAttempts = 0

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
  if (!win) {
    console.warn('[playtime]', 'recap.wait-window', { queued: queue.length })
    if (windowWaitAttempts < 10) {
      windowWaitAttempts += 1
      setTimeout(() => pumpQueue(), 500)
    }
    return
  }
  windowWaitAttempts = 0

  const payload = queue.shift()!
  showing = true
  console.log('[playtime]', 'recap.show', {
    appid: payload.appid,
    seconds: payload.durationSeconds,
    unlocks: payload.unlocks.length
  })
  win.webContents.send('session-recap', payload)
}

export function acknowledgeSessionRecap(): void {
  showing = false
  pumpQueue()
}

/**
 * Builds the recap payload for a live session window.
 *
 * @param appid - Steam AppID
 * @param sessionStartMs - Session start epoch ms
 * @param sessionEndMs - Session end epoch ms
 */
function buildSessionRecap(
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
  const unlocks = toCacheIconUnlocks(
    appid,
    unlocksInSessionWindow(getAchievementsForGame(db, appid), startSec, endSec)
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
  if (!settings.sessionRecapEnabled) {
    console.log('[playtime]', 'recap.skip', { appid, reason: 'disabled' })
    return
  }

  const elapsedSeconds = Math.max(
    1,
    Math.floor((sessionEndMs - sessionStartMs) / 1000)
  )
  if (!shouldOfferSessionRecap(elapsedSeconds)) {
    console.log('[playtime]', 'recap.skip', {
      appid,
      elapsedSeconds,
      minSeconds: SESSION_RECAP_MIN_SECONDS
    })
    return
  }

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
  const unlocks = toCacheIconUnlocks(
    game.appid,
    pickDemoUnlocks(getAchievementsForGame(db, game.appid), 3)
  )
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
