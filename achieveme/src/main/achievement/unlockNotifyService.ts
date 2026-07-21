import { Notification } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadSettings } from '../settings'
import type { UnlockChange } from '../../shared/types'

let navigateToGame: ((appid: string) => void) | null = null

export function setUnlockNavigationHandler(handler: (appid: string) => void): void {
  navigateToGame = handler
}

export function notifyUnlocks(appid: string, gameName: string, unlocks: UnlockChange[]): void {
  if (unlocks.length === 0) return

  const settings = loadSettings()
  if (!settings.notificationsEnabled) return

  for (const unlock of unlocks) {
    showUnlockToast(appid, gameName, unlock)
  }

  if (settings.soundEnabled) {
    playUnlockSound(settings.customSoundPath)
  }
}

function showUnlockToast(appid: string, gameName: string, unlock: UnlockChange): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title: gameName,
    body: unlock.displayName,
    silent: true
  })

  notification.on('click', () => {
    navigateToGame?.(appid)
  })

  notification.show()
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

/** @internal test hook */
export function resolveUnlockSoundPath(customSoundPath: string): string | null {
  const trimmed = customSoundPath.trim()
  if (!trimmed) return null
  const resolved = path.resolve(trimmed)
  return fs.existsSync(resolved) ? resolved : null
}
