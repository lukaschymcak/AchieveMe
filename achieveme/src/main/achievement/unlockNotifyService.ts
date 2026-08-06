import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import { loadSettings } from '../settings'
import type { UnlockChange, UnlockToastPayload } from '../../shared/types'
import {
  nextToastPreviewIndex,
  toastPreviewDisplayName,
  toastPreviewTierAt
} from '../../shared/unlockToastUtils'
import {
  buildDefaultSystemSoundCommand,
  isSupportedUnlockSoundPath,
  soundVolumeToGain
} from '../../shared/unlockSoundUtils'
import {
  destroyUnlockToastWindow,
  enqueueUnlockToast,
  resetUnlockToastQueue,
  setToastDeliveredHandler,
  setToastNavigateHandler
} from './unlockToastWindow'

let previewIndex = 0
let soundWindow: BrowserWindow | null = null
let deliveredSoundRegistered = false

function ensureDeliveredSoundHandler(): void {
  if (deliveredSoundRegistered) return
  deliveredSoundRegistered = true
  setToastDeliveredHandler(() => {
    const settings = loadSettings()
    if (!settings.soundEnabled) return
    playUnlockSound(settings.customSoundPath, settings.soundVolume)
  })
}

export function setUnlockNavigationHandler(handler: (appid: string) => void): void {
  ensureDeliveredSoundHandler()
  setToastNavigateHandler(handler)
}

export function notifyUnlocks(appid: string, gameName: string, unlocks: UnlockChange[]): void {
  if (unlocks.length === 0) return

  ensureDeliveredSoundHandler()
  const settings = loadSettings()

  if (settings.notificationsEnabled) {
    for (const unlock of unlocks) {
      const payload: UnlockToastPayload = {
        appid,
        gameName,
        displayName: unlock.displayName,
        iconUrl: unlock.iconUrl,
        tier: unlock.tier
      }
      enqueueUnlockToast(payload)
    }
  }
}

/** Platinum celebration when a game first reaches 100% completion. */
export function notifyPlatinumUnlock(appid: string, gameName: string): void {
  ensureDeliveredSoundHandler()
  const settings = loadSettings()

  if (settings.notificationsEnabled) {
    const payload: UnlockToastPayload = {
      appid,
      gameName,
      displayName: 'All achievements unlocked',
      iconUrl: '',
      tier: 'platinum'
    }
    enqueueUnlockToast(payload)
  }
}

/** Sample toast for Settings — cycles rarity skins; ignores notificationsEnabled; respects sound. */
export function previewUnlockToast(): void {
  ensureDeliveredSoundHandler()
  const tier = toastPreviewTierAt(previewIndex)
  previewIndex = nextToastPreviewIndex(previewIndex)

  // Destroy + recreate toast window so toast-ready re-handshakes after stuck states.
  resetUnlockToastQueue()

  const payload: UnlockToastPayload = {
    appid: '0',
    gameName: '',
    displayName: toastPreviewDisplayName(tier),
    iconUrl: '',
    tier
  }
  enqueueUnlockToast(payload)
}

function ensureSoundWindow(): BrowserWindow {
  if (soundWindow && !soundWindow.isDestroyed()) {
    return soundWindow
  }

  soundWindow = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      // Allow file:// Audio for user-picked unlock sounds.
      webSecurity: false
    }
  })

  void soundWindow.loadURL('about:blank')

  soundWindow.on('closed', () => {
    soundWindow = null
  })

  return soundWindow
}

function playAudioFile(filePath: string, gain: number): void {
  const fileUrl = pathToFileURL(filePath).href
  const win = ensureSoundWindow()

  const runPlay = (): void => {
    void win.webContents
      .executeJavaScript(
        `(() => {
          const a = new Audio(${JSON.stringify(fileUrl)});
          a.volume = ${JSON.stringify(gain)};
          return a.play().catch(() => {});
        })()`
      )
      .catch(() => {
        if (gain > 0) {
          playDefaultSystemSound()
        }
      })
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', runPlay)
  } else {
    runPlay()
  }
}

function playDefaultSystemSound(): void {
  spawn(
    'powershell',
    ['-NoProfile', '-Command', buildDefaultSystemSoundCommand()],
    { detached: true, stdio: 'ignore', windowsHide: true }
  ).unref()
}

/** Prefer Windows Notify.wav so default chime respects Electron Audio volume. */
function resolveDefaultNotifyWavPath(): string | null {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR
  if (!systemRoot) return null
  const candidate = path.join(systemRoot, 'Media', 'Windows Notify.wav')
  return fs.existsSync(candidate) ? candidate : null
}

function playUnlockSound(customSoundPath: string, soundVolume: number): void {
  const gain = soundVolumeToGain(soundVolume)
  if (gain <= 0) return

  const resolved = resolveUnlockSoundPath(customSoundPath)
  if (resolved) {
    playAudioFile(resolved, gain)
    return
  }

  const defaultWav = resolveDefaultNotifyWavPath()
  if (defaultWav) {
    playAudioFile(defaultWav, gain)
    return
  }

  playDefaultSystemSound()
}

function destroySoundWindow(): void {
  if (soundWindow && !soundWindow.isDestroyed()) {
    soundWindow.destroy()
  }
  soundWindow = null
}

export function cleanupUnlockNotifications(): void {
  destroyUnlockToastWindow()
  destroySoundWindow()
}

/** Resolves a custom sound path when the file exists and has a supported extension. */
export function resolveUnlockSoundPath(customSoundPath: string): string | null {
  const trimmed = customSoundPath.trim()
  if (!trimmed) return null
  const resolved = path.resolve(trimmed)
  if (!isSupportedUnlockSoundPath(resolved)) return null
  return fs.existsSync(resolved) ? resolved : null
}

/** @internal test hook */
export function resetPreviewTierIndex(): void {
  previewIndex = 0
}
