import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import AdmZip from 'adm-zip'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { processZip, manifestFilePath } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/manifestZipService.ts')).href
)
const { scanSteamApiDll } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/depotScanUtils.ts')).href
)

test('processZip parses lua depots and extracts manifests', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-zip-'))
  const zipPath = path.join(tmp, '123.zip')
  const lua = `
addappid(570) -- Dota 2
addappid(571, 1, "abcdef0123456789abcdef0123456789") -- Content
addappid(572) -- DLC Example
setManifestid(571, "999888777", 1048576)
`
  const zip = new AdmZip()
  zip.addFile('570.lua', Buffer.from(lua, 'utf8'))
  zip.addFile('571_999888777.manifest', Buffer.from('manifest-bytes'))
  zip.writeZip(zipPath)

  const data = await processZip(zipPath)
  assert.equal(data.appId, '570')
  assert.equal(data.gameName, 'Dota 2')
  assert.ok(data.depots['571'])
  assert.equal(data.depots['571'].key, 'abcdef0123456789abcdef0123456789')
  assert.equal(data.depots['571'].size, 1048576)
  assert.equal(data.dlcs['572'], 'DLC Example')
  assert.equal(data.manifests['571'], '999888777')
  assert.equal(
    manifestFilePath('571', '999888777'),
    path.join(os.tmpdir(), 'achieveme_manifests', '571_999888777.manifest')
  )
  assert.ok(fs.existsSync(manifestFilePath('571', '999888777')))
})

test('processZip blacklists soundtrack depots', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-zip-'))
  const zipPath = path.join(tmp, 'ost.zip')
  const lua = `
addappid(100) -- Game
addappid(101, 1, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -- Original Soundtrack
`
  const zip = new AdmZip()
  zip.addFile('100.lua', Buffer.from(lua, 'utf8'))
  zip.writeZip(zipPath)

  const data = await processZip(zipPath)
  assert.equal(Object.keys(data.depots).length, 0)
})

test('scanSteamApiDll finds steam_api64.dll under nested folders', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-dll-'))
  const nested = path.join(tmp, 'bin', 'win64')
  fs.mkdirSync(nested, { recursive: true })
  const dllPath = path.join(nested, 'steam_api64.dll')
  fs.writeFileSync(dllPath, 'fake')

  const found = scanSteamApiDll(tmp)
  assert.ok(found)
  assert.equal(found.architecture, 'x64')
  assert.equal(found.path, dllPath)
})

test('scanSteamApiDll returns null when missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-nodll-'))
  assert.equal(scanSteamApiDll(tmp), null)
})
