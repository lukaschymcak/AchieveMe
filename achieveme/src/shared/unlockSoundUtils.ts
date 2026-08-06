import path from 'node:path'

const SUPPORTED_SOUND_EXTENSIONS = new Set(['.wav', '.mp3'])

/**
 * Returns true when the path has a supported unlock-sound extension (.wav / .mp3).
 *
 * @param filePath - Absolute or relative sound file path
 */
export const isSupportedUnlockSoundPath = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase()
  return SUPPORTED_SOUND_EXTENSIONS.has(ext)
}

/**
 * PowerShell command that plays the Windows Asterisk system sound and waits
 * so a detached process outlives the chime.
 */
export const buildDefaultSystemSoundCommand = (): string =>
  '[System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 1000'

/**
 * Clamps a settings volume to an integer in 0–100. Invalid values become 100.
 *
 * @param value - Raw volume from settings JSON or UI
 */
export const clampSoundVolume = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 100
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

/**
 * Converts a 0–100 volume setting to an HTMLAudioElement gain (0–1).
 *
 * @param soundVolume - Clamped 0–100 volume
 */
export const soundVolumeToGain = (soundVolume: number): number =>
  clampSoundVolume(soundVolume) / 100
