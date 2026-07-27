import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(rootDir, '../electron-builder.json5')

function stripJson5Comments(text) {
  let result = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"' || ch === "'") {
      const quote = ch
      result += ch
      i += 1
      while (i < text.length) {
        const c = text[i]
        result += c
        if (c === '\\') {
          i += 1
          if (i < text.length) {
            result += text[i]
            i += 1
          }
          continue
        }
        if (c === quote) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }

    if (ch === '/' && next === '/') {
      i += 2
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }

    result += ch
    i += 1
  }
  return result
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

test('electron-builder extraResources bundles Goldberg regular release DLLs', () => {
  const config = loadElectronBuilderConfig()
  const resource = config.extraResources?.[1]

  assert.ok(resource, 'regular release extraResources entry is required')
  assert.equal(resource.from, '../goldberg-files/release/regular')
  assert.equal(resource.to, 'goldberg_release/regular')

  const filter = resource.filter ?? []
  assert.match(filter.join('\n'), /\*\*\/\*/)
})
