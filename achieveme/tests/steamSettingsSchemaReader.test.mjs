import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { readSteamSettingsSchema } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/steamSettingsSchemaReader.ts')).href
)

function writeSchema(installPath, entries) {
  const settingsDir = path.join(installPath, 'steam_settings')
  fs.mkdirSync(path.join(settingsDir, 'images'), { recursive: true })
  fs.writeFileSync(
    path.join(settingsDir, 'achievements.json'),
    typeof entries === 'string' ? entries : JSON.stringify(entries)
  )
  return settingsDir
}

test('readSteamSettingsSchema maps Goldberg achievements and relative icons', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    const settingsDir = writeSchema(tmp, [
      {
        name: 'ACH_WIN_ONE_GAME',
        displayName: 'Win one game',
        description: 'Win at least one game.',
        hidden: '0',
        icon: 'images/ACH_WIN_ONE_GAME.jpg',
        icon_gray: 'images/ACH_WIN_ONE_GAME_locked.jpg'
      },
      {
        name: 'ACH_SECRET',
        displayName: 'Secret win',
        description: 'Hidden until earned.',
        hidden: '1',
        icon: 'ACH_SECRET.jpg',
        icongray: 'ACH_SECRET_locked.jpg'
      }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema.length, 2)

    assert.deepEqual(result.schema[0], {
      name: 'ACH_WIN_ONE_GAME',
      displayName: 'Win one game',
      description: 'Win at least one game.',
      icon: 'ACH_WIN_ONE_GAME.jpg',
      icongray: 'ACH_WIN_ONE_GAME_locked.jpg',
      hidden: 0
    })
    assert.equal(result.schema[1].icon, 'ACH_SECRET.jpg')
    assert.equal(result.schema[1].icongray, 'ACH_SECRET_locked.jpg')
    assert.equal(result.schema[1].hidden, 1)

    assert.equal(
      result.iconSources.get('ACH_WIN_ONE_GAME.jpg'),
      path.resolve(settingsDir, 'images/ACH_WIN_ONE_GAME.jpg')
    )
    assert.equal(
      result.iconSources.get('ACH_SECRET.jpg'),
      path.resolve(settingsDir, 'ACH_SECRET.jpg')
    )
    assert.equal(
      result.iconSources.get('ACH_SECRET_locked.jpg'),
      path.resolve(settingsDir, 'ACH_SECRET_locked.jpg')
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema accepts numeric hidden flags', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [
      { name: 'VISIBLE', displayName: 'Visible', hidden: 0, icon: 'v.jpg', icon_gray: 'v_locked.jpg' },
      { name: 'HIDDEN', displayName: 'Hidden', hidden: 1, icon: 'h.jpg', icon_gray: 'h_locked.jpg' }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema[0].hidden, 0)
    assert.equal(result.schema[1].hidden, 1)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema skips entries without a name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [
      { displayName: 'No api name', icon: 'skip.jpg' },
      { name: '   ', displayName: 'Blank' },
      { name: 'KEEP', displayName: 'Keep me', description: 'ok', hidden: '0', icon: 'keep.jpg' }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema.length, 1)
    assert.equal(result.schema[0].name, 'KEEP')
    assert.equal(result.schema[0].icon, 'keep.jpg')
    assert.equal(result.iconSources.has('skip.jpg'), false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema returns null for a missing file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    assert.equal(readSteamSettingsSchema(tmp), null)
    assert.equal(readSteamSettingsSchema(''), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema returns null for malformed JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, '{ not json')
    assert.equal(readSteamSettingsSchema(tmp), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema returns null for an empty or non-array schema', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [])
    assert.equal(readSteamSettingsSchema(tmp), null)

    writeSchema(tmp, { name: 'ACH' })
    assert.equal(readSteamSettingsSchema(tmp), null)

    writeSchema(tmp, [{ displayName: 'missing name' }])
    assert.equal(readSteamSettingsSchema(tmp), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema ignores icon paths that leave steam_settings', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [
      {
        name: 'ACH_SAFE',
        displayName: 'Safe',
        icon: '../outside.jpg',
        icon_gray: 'images/locked.jpg'
      }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema[0].icon, '')
    assert.equal(result.schema[0].icongray, 'locked.jpg')
    assert.equal(result.iconSources.has('outside.jpg'), false)
    assert.equal(result.iconSources.has('locked.jpg'), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema reads english displayName and description objects', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [
      {
        name: 'ACH_RESIGNATION',
        displayName: { english: 'Resignation', french: 'Démission' },
        description: {
          english: 'At the Shorefront Family Clinic, show Zoe you understand.'
        },
        hidden: '0',
        icon: 'images/ACH_RESIGNATION.jpg',
        icon_gray: 'images/ACH_RESIGNATION_locked.jpg'
      }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema[0].name, 'ACH_RESIGNATION')
    assert.equal(result.schema[0].displayName, 'Resignation')
    assert.equal(
      result.schema[0].description,
      'At the Shorefront Family Clinic, show Zoe you understand.'
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('readSteamSettingsSchema falls back to the first language then the api name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-schema-'))
  try {
    writeSchema(tmp, [
      {
        name: 'ACH_ONLY_FRENCH',
        displayName: { french: 'Seulement' },
        description: { german: 'Beschreibung' }
      },
      {
        name: 'ACH_EMPTY_TEXT',
        displayName: { english: '   ' },
        description: {}
      }
    ])

    const result = readSteamSettingsSchema(tmp)
    assert.ok(result)
    assert.equal(result.schema[0].displayName, 'Seulement')
    assert.equal(result.schema[0].description, 'Beschreibung')
    assert.equal(result.schema[1].displayName, 'ACH_EMPTY_TEXT')
    assert.equal(result.schema[1].description, '')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
