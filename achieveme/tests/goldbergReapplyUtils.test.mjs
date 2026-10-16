import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { goldbergReapplySteps, shouldShowReapplyGoldberg, chooseReapplyDllPath } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/goldbergReapplyUtils.ts')).href
)

const published = [{ name: 'ACH_ONE' }]

test('reapply without achievements skips the generator and does not seed', () => {
  const steps = goldbergReapplySteps(false, '3669870', published)
  assert.equal(steps.skipGenerator, true)
  assert.equal(steps.copySteamSettings, false)
  assert.equal(steps.seedAchievements, false)
  assert.deepEqual(steps.generatorArgs, ['-skip_ach', '3669870'])
})

test('reapply with achievements keeps the published catalog path', () => {
  const steps = goldbergReapplySteps(true, '480', published)
  assert.equal(steps.skipGenerator, false)
  assert.equal(steps.copySteamSettings, true)
  assert.equal(steps.seedAchievements, true)
  assert.deepEqual(steps.generatorArgs, ['-acw', '480'])
})

test('reapply with achievements and an empty catalog still skips the generator', () => {
  const steps = goldbergReapplySteps(true, '3669870', [])
  assert.equal(steps.skipGenerator, true)
  assert.equal(steps.seedAchievements, false)
  assert.deepEqual(steps.generatorArgs, ['-skip_ach', '3669870'])
})

test('Reapply Goldberg shows whenever an install path is set', () => {
  assert.equal(shouldShowReapplyGoldberg('D:\\Games\\Control Resonant'), true)
  assert.equal(shouldShowReapplyGoldberg('  '), false)
  assert.equal(shouldShowReapplyGoldberg(''), false)
  assert.equal(shouldShowReapplyGoldberg(null), false)
})

test('chooseReapplyDllPath prefers the saved path when the scan found that file', () => {
  const saved = 'D:\\Games\\Control Resonant\\steam_api64.dll'
  assert.equal(chooseReapplyDllPath(saved, saved), saved)
  assert.equal(
    chooseReapplyDllPath(saved, 'D:\\Games\\Control Resonant\\bin\\steam_api64.dll'),
    'D:\\Games\\Control Resonant\\bin\\steam_api64.dll'
  )
  assert.equal(chooseReapplyDllPath(saved, ''), '')
  assert.equal(chooseReapplyDllPath('', null), '')
})
