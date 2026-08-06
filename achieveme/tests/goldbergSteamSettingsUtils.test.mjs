import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  DENUVO_PRESERVE_CONFIG_FILES,
  installSteamSettings
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/goldbergSteamSettingsUtils.ts')).href
)

/**
 * @returns {{ root: string, source: string, target: string }}
 */
function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-steam-settings-'))
  const source = path.join(root, 'source')
  const target = path.join(root, 'target')
  fs.mkdirSync(source)
  return { root, source, target }
}

test('installSteamSettings without preserve replaces everything', () => {
  const { root, source, target } = makeDirs()
  const logs = []
  try {
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'configs.user.ini'), 'OLD_USER')
    fs.writeFileSync(path.join(target, 'junk.txt'), 'JUNK')
    fs.writeFileSync(path.join(source, 'configs.user.ini'), 'NEW_USER')
    fs.writeFileSync(path.join(source, 'achievements.json'), '[]')

    const restored = installSteamSettings({
      source,
      target,
      preserveDenuvoConfigs: false,
      log: (line) => logs.push(line)
    })

    assert.deepEqual(restored, [])
    assert.equal(fs.readFileSync(path.join(target, 'configs.user.ini'), 'utf8'), 'NEW_USER')
    assert.equal(fs.readFileSync(path.join(target, 'achievements.json'), 'utf8'), '[]')
    assert.equal(fs.existsSync(path.join(target, 'junk.txt')), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('installSteamSettings with preserve keeps denuvo INIs and drops other old files', () => {
  const { root, source, target } = makeDirs()
  const logs = []
  try {
    fs.mkdirSync(target)
    for (const name of DENUVO_PRESERVE_CONFIG_FILES) {
      fs.writeFileSync(path.join(target, name), `CUSTOM_${name}`)
    }
    fs.writeFileSync(path.join(target, 'junk.txt'), 'JUNK')
    fs.writeFileSync(path.join(target, 'old_achievements.json'), '{}')

    for (const name of DENUVO_PRESERVE_CONFIG_FILES) {
      fs.writeFileSync(path.join(source, name), `GEN_${name}`)
    }
    fs.writeFileSync(path.join(source, 'achievements.json'), '[{"name":"a"}]')
    fs.writeFileSync(path.join(source, 'steam_appid.txt'), '123')

    const restored = installSteamSettings({
      source,
      target,
      preserveDenuvoConfigs: true,
      log: (line) => logs.push(line)
    })

    assert.equal(restored.length, DENUVO_PRESERVE_CONFIG_FILES.length)
    for (const name of DENUVO_PRESERVE_CONFIG_FILES) {
      assert.equal(fs.readFileSync(path.join(target, name), 'utf8'), `CUSTOM_${name}`)
    }
    assert.equal(fs.readFileSync(path.join(target, 'achievements.json'), 'utf8'), '[{"name":"a"}]')
    assert.equal(fs.readFileSync(path.join(target, 'steam_appid.txt'), 'utf8'), '123')
    assert.equal(fs.existsSync(path.join(target, 'junk.txt')), false)
    assert.equal(fs.existsSync(path.join(target, 'old_achievements.json')), false)
    assert.ok(logs.some((l) => /Preserved Denuvo config files/.test(l)))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('installSteamSettings preserve with no existing target installs generator files only', () => {
  const { root, source, target } = makeDirs()
  try {
    fs.writeFileSync(path.join(source, 'configs.user.ini'), 'GEN_USER')
    fs.writeFileSync(path.join(source, 'achievements.json'), '[]')

    const restored = installSteamSettings({
      source,
      target,
      preserveDenuvoConfigs: true
    })

    assert.deepEqual(restored, [])
    assert.equal(fs.readFileSync(path.join(target, 'configs.user.ini'), 'utf8'), 'GEN_USER')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('installSteamSettings preserve restores only INIs that existed', () => {
  const { root, source, target } = makeDirs()
  try {
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'configs.user.ini'), 'KEEP_USER')
    fs.writeFileSync(path.join(source, 'configs.user.ini'), 'GEN_USER')
    fs.writeFileSync(path.join(source, 'configs.main.ini'), 'GEN_MAIN')
    fs.writeFileSync(path.join(source, 'achievements.json'), '[]')

    const restored = installSteamSettings({
      source,
      target,
      preserveDenuvoConfigs: true
    })

    assert.deepEqual(restored, ['configs.user.ini'])
    assert.equal(fs.readFileSync(path.join(target, 'configs.user.ini'), 'utf8'), 'KEEP_USER')
    assert.equal(fs.readFileSync(path.join(target, 'configs.main.ini'), 'utf8'), 'GEN_MAIN')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
