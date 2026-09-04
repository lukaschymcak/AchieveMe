import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { nextReapplyTool } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/reapplyToolsUtils.ts')).href
)

test('nextReapplyTool returns steamless first when both included', () => {
  assert.equal(
    nextReapplyTool({ includeSteamless: true, includeGoldberg: true, completed: [] }),
    'steamless'
  )
})

test('nextReapplyTool returns goldberg after steamless completes', () => {
  assert.equal(
    nextReapplyTool({
      includeSteamless: true,
      includeGoldberg: true,
      completed: ['steamless']
    }),
    'goldberg'
  )
})

test('nextReapplyTool returns done when both completed', () => {
  assert.equal(
    nextReapplyTool({
      includeSteamless: true,
      includeGoldberg: true,
      completed: ['steamless', 'goldberg']
    }),
    'done'
  )
})

test('nextReapplyTool steamless-only', () => {
  assert.equal(
    nextReapplyTool({ includeSteamless: true, includeGoldberg: false, completed: [] }),
    'steamless'
  )
  assert.equal(
    nextReapplyTool({
      includeSteamless: true,
      includeGoldberg: false,
      completed: ['steamless']
    }),
    'done'
  )
})

test('nextReapplyTool goldberg-only skips steamless', () => {
  assert.equal(
    nextReapplyTool({ includeSteamless: false, includeGoldberg: true, completed: [] }),
    'goldberg'
  )
  assert.equal(
    nextReapplyTool({
      includeSteamless: false,
      includeGoldberg: true,
      completed: ['goldberg']
    }),
    'done'
  )
})

test('nextReapplyTool returns done when nothing included', () => {
  assert.equal(
    nextReapplyTool({ includeSteamless: false, includeGoldberg: false, completed: [] }),
    'done'
  )
})
