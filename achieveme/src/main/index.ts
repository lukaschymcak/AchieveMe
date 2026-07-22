import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db/database'
import { loadSettings } from './settings'
import { startWatcher } from './achievement/watcherService'
import { startPlaytimeTracker, stopPlaytimeTracker } from './achievement/playtimeService'
import { setUnlockNavigationHandler, cleanupUnlockNotifications } from './achievement/unlockNotifyService'
import { registerIpcHandlers } from './ipc/handlers'
import { destroyTray, initTray, isQuitting, setQuitting } from './trayService'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting() && loadSettings().closeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindowAndNavigate(appid: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!mainWindow.isVisible()) mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  mainWindow.webContents.send('navigate-to-game', appid)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.achieveme')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  registerIpcHandlers()
  const settings = loadSettings()
  startWatcher(settings).catch(() => {})
  startPlaytimeTracker()

  createWindow()
  initTray(() => mainWindow)
  setUnlockNavigationHandler(showMainWindowAndNavigate)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  setQuitting(true)
  stopPlaytimeTracker()
  cleanupUnlockNotifications()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (loadSettings().closeToTray) return
  if (process.platform !== 'darwin') app.quit()
})
