import { Tray, Menu, app, nativeImage, type BrowserWindow } from 'electron'

let tray: Tray | null = null
let getMainWindow: (() => BrowserWindow | null) | null = null
let quitting = false

export function setQuitting(value: boolean): void {
  quitting = value
}

export function isQuitting(): boolean {
  return quitting
}

export function initTray(resolveMainWindow: () => BrowserWindow | null): void {
  getMainWindow = resolveMainWindow

  if (tray) {
    tray.destroy()
    tray = null
  }

  const placeholder = nativeImage.createEmpty()
  tray = new Tray(placeholder)
  tray.setToolTip('AchieveMe')
  rebuildTrayMenu()

  tray.on('double-click', () => {
    showMainWindow()
  })

  void app
    .getFileIcon(process.execPath, { size: 'small' })
    .then((icon) => {
      if (tray && !icon.isEmpty()) {
        tray.setImage(icon)
      }
    })
    .catch(() => {
      // Keep empty icon if OS icon lookup fails.
    })
}

function showMainWindow(): void {
  const win = getMainWindow?.()
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

function rebuildTrayMenu(): void {
  if (!tray) return

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show AchieveMe',
      click: () => showMainWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        setQuitting(true)
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
