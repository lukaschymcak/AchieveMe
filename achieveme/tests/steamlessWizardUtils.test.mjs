import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { steamlessGamePickAction, steamlessExeStep } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/steamlessWizardUtils.ts')).href
)

test('steamlessGamePickAction lists folder exes even when launch_exe is unpacked', () => {
  assert.equal(
    steamlessGamePickAction({
      install_path: 'C:\\Games\\Title',
      launch_exe: 'C:\\Games\\Title\\Game.exe.unpacked.exe'
    }),
    'list-exes'
  )
})

test('steamlessGamePickAction ignores launch_exe and browses when no install path', () => {
  assert.equal(
    steamlessGamePickAction({
      install_path: '',
      launch_exe: 'C:\\Games\\Title\\Game.exe'
    }),
    'browse'
  )
})

test('steamlessExeStep always shows picker so original exe can be chosen', () => {
  assert.deepEqual(
    steamlessExeStep([{ absolutePath: 'C:\\Games\\Title\\Game.exe.unpacked.exe' }]),
    { kind: 'show-picker' }
  )
  assert.deepEqual(
    steamlessExeStep([
      { absolutePath: 'C:\\Games\\Title\\Game.exe' },
      { absolutePath: 'C:\\Games\\Title\\Game.exe.unpacked.exe' }
    ]),
    { kind: 'show-picker' }
  )
})
