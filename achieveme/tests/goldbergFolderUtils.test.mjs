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
  goldbergGeneratorArgs,
  goldbergSetupSteps,
  hasSteamSettingsFolder,
  readAchievementSchema,
  resolveGameDir,
  seedGoldbergAchievementSave,
  validateDllPath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/goldbergFolderUtils.ts')).href
)

const { EMPTY_STATES, getEmptyAchievementsMessage } = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/helpContent.ts')).href
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

test('published catalog keeps -acw, copies settings, and does not skip generator', () => {
  const published = [{ name: 'ACH_ONE' }]
  const args = goldbergGeneratorArgs('480', published)
  assert.deepEqual(args, ['-acw', '480'])
  assert.equal(args.includes('-skip_ach'), false)

  const steps = goldbergSetupSteps('480', published)
  assert.equal(steps.skipGenerator, false)
  assert.equal(steps.copySteamSettings, true)
  assert.equal(steps.seedAchievements, true)
  assert.equal(steps.addToLibrary, true)
})

test('null catalog skips generator, does not copy settings, does not seed', () => {
  const args = goldbergGeneratorArgs('3669870', null)
  assert.deepEqual(args, ['-skip_ach', '3669870'])
  assert.equal(args.includes('-acw'), false)
  const steps = goldbergSetupSteps('3669870', null)
  assert.equal(steps.skipGenerator, true)
  assert.equal(steps.copySteamSettings, false)
  assert.equal(steps.seedAchievements, false)
  assert.equal(steps.addToLibrary, true)
})

test('empty catalog skips generator, does not copy settings, does not seed', () => {
  const args = goldbergGeneratorArgs('3669870', [])
  assert.deepEqual(args, ['-skip_ach', '3669870'])
  assert.equal(args.includes('-acw'), false)

  const steps = goldbergSetupSteps('3669870', [])
  assert.equal(steps.skipGenerator, true)
  assert.equal(steps.copySteamSettings, false)
  assert.equal(steps.seedAchievements, false)
  assert.equal(steps.addToLibrary, true)
})

test('empty catalog does not throw or write a save when achievements.json is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-empty-'))
  const savesFile = path.join(tmp, 'saves', 'achievements.json')
  try {
    const result = seedGoldbergAchievementSave({
      emptyCatalog: true,
      schemaPath: path.join(tmp, 'achievements.json'),
      savesFile
    })
    assert.equal(result, 'skipped-empty-catalog')
    assert.equal(fs.existsSync(savesFile), false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('published schema still seeds a locked achievement save', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-goldberg-seed-'))
  const schemaPath = path.join(tmp, 'achievements.json')
  const savesFile = path.join(tmp, 'saves', 'achievements.json')
  try {
    fs.writeFileSync(schemaPath, JSON.stringify([{ name: 'ACH_ONE' }]))
    const result = seedGoldbergAchievementSave({
      emptyCatalog: false,
      schemaPath,
      savesFile
    })
    assert.equal(result, 'seeded')
    assert.deepEqual(JSON.parse(fs.readFileSync(savesFile, 'utf8')), {
      ACH_ONE: { earned: false, earned_time: 0 }
    })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('empty catalog with an API key uses the unpublished schema message', () => {
  const message = getEmptyAchievementsMessage(true, 1)
  assert.equal(message, EMPTY_STATES.noAchievementsFromSteam)
  assert.notEqual(message, EMPTY_STATES.noAchievementsNeedApiKey)
  assert.notEqual(message, EMPTY_STATES.noAchievementsFetchFailed)
})
