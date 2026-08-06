import {
  BrowserWindow,
  ipcMain,
  screen,
  type IpcMainEvent
} from 'electron'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { UnlockToastPayload } from '../../shared/types'
import {
  createToastQueueState,
  enqueueToast,
  markToastIdle,
  takeNextToast,
  type ToastQueueState
} from './unlockToastQueue'

/** Locked toast window size — bump carefully; rebuild main after changing. */
const TOAST_WIDTH = 387
const TOAST_HEIGHT = 97
const MARGIN = 16
const BUSY_TIMEOUT_MS = 22_500

let queueState: ToastQueueState<UnlockToastPayload> = createToastQueueState()
let toastWindow: BrowserWindow | null = null
let navigateHandler: ((appid: string) => void) | null = null
let deliveredHandler: (() => void) | null = null
let ipcRegistered = false
let toastReady = false
let pendingShow: UnlockToastPayload | null = null
let busyWatchdog: ReturnType<typeof setTimeout> | null = null
/** Bumped on deliver/reset/destroy so stale toast-done events are ignored. */
let toastEpoch = 0
/** Epoch of the toast currently showing; 0 when none. */
let deliveredEpoch = 0

export function setToastNavigateHandler(handler: (appid: string) => void): void {
  navigateHandler = handler
}

/** Invoked each time a toast is delivered to the window (sound, analytics, etc.). */
export function setToastDeliveredHandler(handler: (() => void) | null): void {
  deliveredHandler = handler
}

function clearBusyWatchdog(): void {
  if (busyWatchdog) {
    clearTimeout(busyWatchdog)
    busyWatchdog = null
  }
}

function armBusyWatchdog(): void {
  clearBusyWatchdog()
  busyWatchdog = setTimeout(() => {
    busyWatchdog = null
    pendingShow = null
    deliveredEpoch = 0
    toastEpoch += 1
    queueState = markToastIdle(queueState)
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.hide()
    }
    pumpQueue()
  }, BUSY_TIMEOUT_MS)
}

function invalidateToastEpoch(): void {
  toastEpoch += 1
  deliveredEpoch = 0
}

function ensureIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.on('toast-ready', () => {
    toastReady = true
    flushPendingShow()
  })

  ipcMain.on('toast-done', () => {
    handleToastDone()
  })

  ipcMain.on('toast-click', (_event: IpcMainEvent, appid: string) => {
    if (typeof appid === 'string' && appid) {
      navigateHandler?.(appid)
    }
  })
}

function toastPreloadPath(): string {
  return path.join(__dirname, '../preload/toast.mjs')
}

function resolveToastUrl(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/toast.html`
  }
  return path.join(__dirname, '../renderer/toast.html')
}

function positionToast(win: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay()
  const x = Math.round(workArea.x + (workArea.width - TOAST_WIDTH) / 2)
  const y = Math.round(workArea.y + MARGIN)
  win.setBounds({ x, y, width: TOAST_WIDTH, height: TOAST_HEIGHT })
}

function createToastWindow(): BrowserWindow {
  toastReady = false
  const win = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'none' as const } : {}),
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      preload: toastPreloadPath(),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.setBackgroundColor('#00000000')
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  positionToast(win)

  win.webContents.on('did-start-loading', () => {
    toastReady = false
  })

  // Module scripts can send toast-ready before isLoading flips false; retry flush here.
  win.webContents.on('did-finish-load', () => {
    flushPendingShow()
  })

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[unlock-toast] failed to load', { code, desc, url })
    toastReady = false
    pendingShow = null
    invalidateToastEpoch()
    queueState = markToastIdle(queueState)
  })

  const url = resolveToastUrl()
  if (url.startsWith('http')) {
    void win.loadURL(url)
  } else {
    void win.loadFile(url)
  }

  win.on('closed', () => {
    if (toastWindow === win) toastWindow = null
    toastReady = false
  })

  return win
}

function ensureToastWindow(): BrowserWindow {
  if (toastWindow && !toastWindow.isDestroyed()) {
    return toastWindow
  }
  toastWindow = createToastWindow()
  return toastWindow
}

function deliverShow(win: BrowserWindow, payload: UnlockToastPayload): void {
  pendingShow = null
  toastEpoch += 1
  deliveredEpoch = toastEpoch
  positionToast(win)
  win.setBackgroundColor('#00000000')
  win.webContents.send('toast-show', payload)
  if (!win.isVisible()) {
    win.show()
  }
  armBusyWatchdog()
  try {
    deliveredHandler?.()
  } catch (err) {
    console.error('[unlock-toast] delivered handler failed', err)
  }
}

function flushPendingShow(): void {
  if (!pendingShow) return
  if (!toastWindow || toastWindow.isDestroyed()) return
  // Page said ready — do not gate on isLoading() (that caused a permanent stuck queue).
  if (!toastReady) return
  deliverShow(toastWindow, pendingShow)
}

function tryShowPayload(payload: UnlockToastPayload): void {
  const win = ensureToastWindow()

  if (!toastReady) {
    pendingShow = payload
    // Busy without deliverShow previously left the queue stuck forever if toast-ready never fired.
    armBusyWatchdog()
    return
  }

  deliverShow(win, payload)
}

function pumpQueue(): void {
  const result = takeNextToast(queueState)
  queueState = result.state
  if (!result.item) return
  tryShowPayload(result.item)
}

function handleToastDone(): void {
  if (deliveredEpoch === 0 || deliveredEpoch !== toastEpoch) {
    return
  }
  deliveredEpoch = 0
  clearBusyWatchdog()
  pendingShow = null
  queueState = markToastIdle(queueState)
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.hide()
  }
  pumpQueue()
}

export function enqueueUnlockToast(payload: UnlockToastPayload): void {
  ensureIpc()
  queueState = enqueueToast(queueState, payload)
  pumpQueue()
}

/**
 * Unblock a stuck toast queue and destroy the toast window so the next enqueue
 * reloads and re-handshakes toast-ready.
 */
export function resetUnlockToastQueue(): void {
  clearBusyWatchdog()
  pendingShow = null
  queueState = createToastQueueState()
  invalidateToastEpoch()
  toastReady = false
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.destroy()
  }
  toastWindow = null
}

export function destroyUnlockToastWindow(): void {
  clearBusyWatchdog()
  pendingShow = null
  queueState = createToastQueueState()
  invalidateToastEpoch()
  toastReady = false
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.destroy()
  }
  toastWindow = null
}
