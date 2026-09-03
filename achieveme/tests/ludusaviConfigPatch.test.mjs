import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  patchRclonePathInConfigYaml,
  patchCloudSynchronizeInConfigYaml,
  writeRclonePathToLudusaviConfig,
  writeCloudSynchronizeToLudusaviConfig
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviConfigPatch.ts')).href
)

test('patchRclonePathInConfigYaml appends apps.rclone when empty', () => {
  const out = patchRclonePathInConfigYaml('', 'C:\\Tools\\rclone.exe')
  assert.match(out, /apps:/)
  assert.match(out, /rclone:/)
  assert.match(out, /path:\s*"C:\/Tools\/rclone\.exe"/)
})

test('patchRclonePathInConfigYaml replaces existing rclone path', () => {
  const prev = 'apps:\n  rclone:\n    path: "C:/old/rclone.exe"\n    arguments: "--fast-list"\n'
  const out = patchRclonePathInConfigYaml(prev, 'D:\\rclone\\rclone.exe')
  assert.match(out, /path:\s*"D:\/rclone\/rclone\.exe"/)
  assert.doesNotMatch(out, /C:\/old/)
})

test('patchCloudSynchronizeInConfigYaml sets synchronize', () => {
  const out = patchCloudSynchronizeInConfigYaml('', true)
  assert.match(out, /synchronize:\s*true/)
  const off = patchCloudSynchronizeInConfigYaml(out, false)
  assert.match(off, /synchronize:\s*false/)
})

test('write helpers persist to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-cfg-'))
  writeRclonePathToLudusaviConfig(dir, 'C:\\Tools\\rclone.exe')
  writeCloudSynchronizeToLudusaviConfig(dir, true)
  const text = fs.readFileSync(path.join(dir, 'config.yaml'), 'utf8')
  assert.match(text, /rclone\.exe/)
  assert.match(text, /synchronize:\s*true/)
  fs.rmSync(dir, { recursive: true, force: true })
})
