import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  buildProgressFromSchema,
  findSteamApiDll,
  hasSteamSettingsFolder,
  readAchievementSchema,
  resolveGameDir,
  validateDllPath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/goldbergFolderUtils.ts')).href
)

test('resolveGameDir rejects missing directories', () => {
  assert.throws(
    () => resolveGameDir(path.join(os.tmpdir(), 'achieveme-missing-game-dir-xyz')),
    /Game folder was not found/
  )
})

test('validateDllPath resolves game folder from steam_api64.dll', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-'))
  try {
    const dllPath = path.join(tmp, 'steam_api64.dll')
    fs.writeFileSync(dllPath, 'dll')

    const info = validateDllPath(dllPath)
    assert.equal(info.fileName, 'steam_api64.dll')
    assert.equal(info.gameDir, tmp)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('validateDllPath rejects invalid file names', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-'))
  try {
    const dllPath = path.join(tmp, 'other.dll')
    fs.writeFileSync(dllPath, 'dll')
    assert.throws(() => validateDllPath(dllPath), /steam_api/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('hasSteamSettingsFolder detects steam_settings directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-'))
  try {
    assert.equal(hasSteamSettingsFolder(tmp), false)
    fs.mkdirSync(path.join(tmp, 'steam_settings'))
    assert.equal(hasSteamSettingsFolder(tmp), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('findSteamApiDll prefers x64 DLL in game folder', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-'))
  try {
    fs.writeFileSync(path.join(tmp, 'steam_api.dll'), 'x86')
    fs.writeFileSync(path.join(tmp, 'steam_api64.dll'), 'x64')

    const info = findSteamApiDll(tmp)
    assert.ok(info)
    assert.equal(info.fileName, 'steam_api64.dll')
    assert.equal(info.architecture, 'x64')
    assert.equal(info.directory, tmp)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readAchievementSchema and buildProgressFromSchema read array schema', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-'))
  try {
    const schemaPath = path.join(tmp, 'achievements.json')
    fs.writeFileSync(
      schemaPath,
      JSON.stringify([{ name: 'ACH_ONE' }, { name: 'ACH_TWO' }])
    )

    const schema = readAchievementSchema(schemaPath)
    const progress = buildProgressFromSchema(schema)

    assert.deepEqual(progress, {
      ACH_ONE: { earned: false, earned_time: 0 },
      ACH_TWO: { earned: false, earned_time: 0 }
    })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('buildProgressFromSchema rejects empty schema', () => {
  assert.throws(() => buildProgressFromSchema([]), /No achievements found/)
})
