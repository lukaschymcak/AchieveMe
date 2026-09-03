import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const helpContent = await import(
  pathToFileURL(path.join(rootDir, '../src/renderer/src/lib/helpContent.ts')).href
)

const {
  EMULATOR_SOURCES,
  HELP_SECTIONS,
  getSourceHelp,
  TOOLTIPS,
  EMPTY_STATES,
  getEmptyAchievementsMessage,
  DELETE_CONFIRM
} = helpContent

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
    assert.ok(ids.includes('notifications'))
    assert.ok(ids.includes('tray'))
    assert.ok(ids.includes('play-sessions'))
    assert.ok(ids.includes('news'))
    assert.ok(ids.includes('faq'))
    assert.ok(ids.includes('delete'))
  })

  it('DELETE_CONFIRM mentions ignore list for leftover CODEX/RUNE', () => {
    assert.match(DELETE_CONFIRM, /ignored/i)
    assert.match(DELETE_CONFIRM, /CODEX|RUNE/i)
  })

  it('Removing games section documents ignore list', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'delete')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /ignore/i)
    assert.match(body, /CODEX|RUNE/i)
  })

  it('defines news refresh tooltip and empty states', () => {
    assert.match(TOOLTIPS.refreshNews, /cache/i)
    assert.match(TOOLTIPS.refreshNews, /wishlist/i)
    assert.match(EMPTY_STATES.noNewsReleases, /popular/i)
    assert.match(EMPTY_STATES.noNewsReleasesFiltered, /genre/i)
    assert.match(EMPTY_STATES.noLibraryNews, /library/i)
  })

  it('getEmptyAchievementsMessage distinguishes key / steam-empty / fetch-failed', () => {
    assert.equal(
      getEmptyAchievementsMessage(false, 0),
      EMPTY_STATES.noAchievementsNeedApiKey
    )
    assert.equal(
      getEmptyAchievementsMessage(true, 1710000000),
      EMPTY_STATES.noAchievementsFromSteam
    )
    assert.equal(
      getEmptyAchievementsMessage(true, 0),
      EMPTY_STATES.noAchievementsFetchFailed
    )
    assert.match(EMPTY_STATES.noAchievementsFromSteam, /not published|unreleased|later/i)
  })
})
