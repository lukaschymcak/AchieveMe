import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const helpContent = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/helpContent.ts')).href
)

const { EMULATOR_SOURCES, HELP_SECTIONS, getSourceHelp, TOOLTIPS } = helpContent

describe('helpContent', () => {
  it('lists every emulator source with path and file', () => {
    assert.equal(EMULATOR_SOURCES.length, 4)
    for (const row of EMULATOR_SOURCES) {
      assert.ok(row.id)
      assert.ok(row.defaultPath)
      assert.ok(row.fileName)
    }
  })

  it('getSourceHelp returns goldberg notes', () => {
    const goldberg = getSourceHelp('goldberg')
    assert.ok(goldberg)
    assert.match(goldberg.notes ?? '', /write-back/i)
  })

  it('defines refresh tooltips for library and game detail', () => {
    assert.match(TOOLTIPS.refreshLibrary, /entire library/i)
    assert.match(TOOLTIPS.refreshGameDetail, /entire library/i)
    assert.match(TOOLTIPS.refreshGameMenu, /this game/i)
  })

  it('includes core help sections', () => {
    const ids = HELP_SECTIONS.map((s) => s.id)
    assert.ok(ids.includes('about'))
    assert.ok(ids.includes('sync'))
    assert.ok(ids.includes('backup'))
    assert.ok(ids.includes('faq'))
  })
})
