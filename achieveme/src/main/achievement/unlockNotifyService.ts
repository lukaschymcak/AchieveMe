import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../settings'
import type { UnlockChange, UnlockToastPayload } from '../../shared/types'
import {
  nextToastPreviewIndex,
  toastPreviewDisplayName,
  toastPreviewTierAt
} from '../../shared/unlockToastUtils'
import {
  destroyUnlockToastWindow,
  enqueueUnlockToast,
  resetUnlockToastQueue,
  setToastNavigateHandler
} from './unlockToastWindow'

let previewIndex = 0

export function setUnlockNavigationHandler(handler: (appid: string) => void): void {
  setToastNavigateHandler(handler)
}

export function notifyUnlocks(appid: string, gameName: string, unlocks: UnlockChange[]): void {
  if (unlocks.length === 0) return

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

  if (settings.soundEnabled) {
    playUnlockSound(settings.customSoundPath)
  }
}

/** Platinum celebration when a game first reaches 100% completion. */
export function notifyPlatinumUnlock(
  appid: string,
  gameName: string,
  playSound: boolean
): void {
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

  if (playSound && settings.soundEnabled) {
    playUnlockSound(settings.customSoundPath)
  }
}

/** Sample toast for Settings — cycles rarity skins; ignores notificationsEnabled; respects sound. */
export function previewUnlockToast(): void {
  const settings = loadSettings()
  const tier = toastPreviewTierAt(previewIndex)
  previewIndex = nextToastPreviewIndex(previewIndex)

  // Clear a stuck queue without reloading the toast page (reload made the icon phase invisible).
  resetUnlockToastQueue()

  const payload: UnlockToastPayload = {
    appid: '0',
    gameName: '',
    displayName: toastPreviewDisplayName(tier),
    iconUrl: '',
    tier
  }
  enqueueUnlockToast(payload)

  if (settings.soundEnabled) {
    playUnlockSound(settings.customSoundPath)
  }
}

function playUnlockSound(customSoundPath: string): void {
  const trimmed = customSoundPath.trim()
  if (trimmed && fs.existsSync(trimmed)) {
    const escaped = trimmed.replace(/'/g, "''")
    spawn(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `$player = New-Object System.Media.SoundPlayer '${escaped}'; $player.Play()`
      ],
      { detached: true, stdio: 'ignore', windowsHide: true }
    ).unref()
    return
  }

  spawn(
    'powershell',
    ['-NoProfile', '-Command', '[System.Media.SystemSounds]::Asterisk.Play()'],
    { detached: true, stdio: 'ignore', windowsHide: true }
  ).unref()
}

export function cleanupUnlockNotifications(): void {
  destroyUnlockToastWindow()
}

/** @internal test hook */
export function resolveUnlockSoundPath(customSoundPath: string): string | null {
  const trimmed = customSoundPath.trim()
  if (!trimmed) return null
  const resolved = path.resolve(trimmed)
  return fs.existsSync(resolved) ? resolved : null
}

/** @internal test hook */
export function resetPreviewTierIndex(): void {
  previewIndex = 0
}
