import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(rootDir, '../electron-builder.json5')

function stripJson5Comments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function loadElectronBuilderConfig() {
  const raw = fs.readFileSync(configPath, 'utf8')
  return JSON.parse(stripJson5Comments(raw))
}

test('electron-builder config uses AchieveMe identity', () => {
  const config = loadElectronBuilderConfig()

  assert.equal(config.appId, 'com.achieveme.app')
  assert.equal(config.productName, 'AchieveMe')
})

test('electron-builder config targets Windows NSIS x64', () => {
  const config = loadElectronBuilderConfig()
  const winTarget = config.win?.target?.[0]

  assert.equal(winTarget?.target, 'nsis')
  assert.deepEqual(winTarget?.arch, ['x64'])
})

test('electron-builder extraResources bundles generate_emu_config with safe filters', () => {
  const config = loadElectronBuilderConfig()
  const resource = config.extraResources?.[0]

  assert.ok(resource, 'extraResources entry is required')
  assert.equal(resource.from, '../goldberg-files/generate_emu_config')
  assert.equal(resource.to, 'generate_emu_config')

  const filter = resource.filter ?? []
  const filterText = filter.join('\n')

  assert.match(filterText, /\*\*\/\*/)
  assert.match(filterText, /!_OUTPUT\/\*\*/)
  assert.match(filterText, /!my_login\.txt/)
  assert.match(filterText, /!appid_finder\/\*\*/)
  assert.match(filterText, /!bat\/\*\*/)
})
