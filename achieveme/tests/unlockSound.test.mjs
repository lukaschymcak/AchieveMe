import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  isSupportedUnlockSoundPath,
  buildDefaultSystemSoundCommand,
  clampSoundVolume,
  soundVolumeToGain
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/unlockSoundUtils.ts')).href)

test('isSupportedUnlockSoundPath accepts wav and mp3', () => {
  assert.equal(isSupportedUnlockSoundPath('C:\\sounds\\unlock.wav'), true)
  assert.equal(isSupportedUnlockSoundPath('C:\\sounds\\unlock.mp3'), true)
  assert.equal(isSupportedUnlockSoundPath('C:\\sounds\\UNLOCK.MP3'), true)
})

test('isSupportedUnlockSoundPath rejects unsupported extensions', () => {
  assert.equal(isSupportedUnlockSoundPath('C:\\sounds\\unlock.ogg'), false)
  assert.equal(isSupportedUnlockSoundPath('C:\\sounds\\unlock'), false)
})

test('buildDefaultSystemSoundCommand keeps process alive for the chime', () => {
  const cmd = buildDefaultSystemSoundCommand()
  assert.match(cmd, /SystemSounds/)
  assert.match(cmd, /Asterisk/)
  assert.match(cmd, /Start-Sleep/)
})

test('clampSoundVolume clamps to 0–100 and defaults invalid values to 100', () => {
  assert.equal(clampSoundVolume(40), 40)
  assert.equal(clampSoundVolume(40.6), 41)
  assert.equal(clampSoundVolume(-5), 0)
  assert.equal(clampSoundVolume(150), 100)
  assert.equal(clampSoundVolume(Number.NaN), 100)
  assert.equal(clampSoundVolume('loud'), 100)
})

test('soundVolumeToGain maps 0–100 to 0–1', () => {
  assert.equal(soundVolumeToGain(0), 0)
  assert.equal(soundVolumeToGain(50), 0.5)
  assert.equal(soundVolumeToGain(100), 1)
})
