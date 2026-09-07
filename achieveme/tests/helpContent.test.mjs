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
  DELETE_CONFIRM,
  SETTINGS_HINTS,
  FIRST_RUN,
  LONG_PRESS_HINT
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
    assert.ok(ids.includes('ludusavi'))
    assert.ok(ids.includes('faq'))
    assert.ok(ids.includes('delete'))
  })

  it('notifications section documents cached toast icons', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'notifications')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /achieveme-img/i)
    assert.match(body, /cache/i)
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

  it('Tools section documents depot downloader and scan', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'tools')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /Depot Downloader/i)
    assert.match(body, /GIDs|manifest/i)
    assert.match(body, /reapply/i)
    assert.match(body, /Steamless/i)
    assert.match(body, /Goldberg/i)
  })

  it('Tools section documents Transfers dock reopen', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'tools')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /Transfers dock/i)
  })

  it('Game detail section documents Update transfer modal', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'game-detail')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /transfer modal/i)
    assert.match(body, /Transfers dock/i)
  })

  it('Game detail section documents hunter stats strip without HLTB hours', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'game-detail')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /Metacritic/i)
    assert.match(body, /Reviews/i)
    assert.match(body, /not a storefront|storefront/i)
    assert.match(body, /HowLongToBeat|not included yet/i)
    assert.doesNotMatch(body, /Main story|hours to beat|HLTB shows/i)
  })

  it('Tools section documents depot update chrome gated by GIDs', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'tools')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /only when depot GIDs are stored/i)
    assert.match(body, /stops on failure|Retry/i)
  })

  it('playGamesFromLauncher tooltip mentions Library Play', () => {
    assert.match(TOOLTIPS.playGamesFromLauncher, /Library/i)
    assert.match(TOOLTIPS.playGamesFromLauncher, /Play/i)
  })

  it('refresh tooltip mentions ignored and depot retain', () => {
    assert.match(TOOLTIPS.refreshLibrary, /ignored|GIDs|install path/i)
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

  it('documents Ludusavi save backup settings', () => {
    assert.match(SETTINGS_HINTS.ludusaviPath, /ludusavi\.exe/i)
    assert.match(SETTINGS_HINTS.ludusaviAutoBackup, /library/i)
    assert.match(SETTINGS_HINTS.rclonePath, /rclone\.exe/i)
    assert.match(SETTINGS_HINTS.rclonePath, /userData|isolated|GUI/i)
    assert.match(SETTINGS_HINTS.ludusaviCloudProvider, /Connect|cloud set/i)
    assert.match(SETTINGS_HINTS.ludusaviCloudSync, /cloud-sync/i)
    assert.match(SETTINGS_HINTS.ludusaviCloudSync, /local-only|Install picker/i)
    assert.match(SETTINGS_HINTS.ludusaviCloudManual, /never auto-resolves|Upload to cloud/i)
    assert.match(TOOLTIPS.settingsLudusavi, /library/i)
    assert.match(TOOLTIPS.settingsLudusavi, /Install backup|restore/i)
    assert.match(TOOLTIPS.settingsLudusavi, /5 full snapshots|pick a snapshot/i)
    assert.match(TOOLTIPS.settingsLudusavi, /when saves change|saves change/i)
    assert.match(TOOLTIPS.settingsLudusavi, /rclone|cloud|userData/i)
    const section = HELP_SECTIONS.find((s) => s.id === 'ludusavi')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /library/i)
    assert.match(body, /Install backup|floppy/i)
    assert.match(body, /full-limit 5|five full snapshots|newest snapshots/i)
    assert.match(body, /when save files change|identical saves/i)
    assert.match(body, /userData|GUI config/i)
    assert.match(body, /Upload to cloud|Download from cloud|never auto/i)
  })

  it('tray section documents installed Setup vs portable login items', () => {
    assert.match(SETTINGS_HINTS.tray, /Setup/i)
    assert.match(SETTINGS_HINTS.tray, /Portable/i)
    assert.match(TOOLTIPS.settingsTray, /Setup/i)
    const section = HELP_SECTIONS.find((s) => s.id === 'tray')
    assert.ok(section)
    const body = [...(section.paragraphs ?? []), ...(section.bullets ?? [])].join(' ')
    assert.match(body, /Setup/i)
    assert.match(body, /Portable/i)
    assert.match(body, /Hide on play|hide.*(game|tray)/i)
  })

  it('play-sessions section documents path tracking and incremental save', () => {
    assert.match(SETTINGS_HINTS.playSessions, /30s|2s|Play path|install/i)
    const section = HELP_SECTIONS.find((s) => s.id === 'play-sessions')
    assert.ok(section)
    const body = [...(section.paragraphs ?? []), ...(section.bullets ?? [])].join(' ')
    assert.match(body, /full path|process name/i)
    assert.match(body, /30 seconds|30s/i)
  })

  it('coach copy teaches right-click for library game actions', () => {
    assert.match(FIRST_RUN.bullets.join(' '), /right-click/i)
    assert.match(LONG_PRESS_HINT.title, /right-click/i)
    assert.match(LONG_PRESS_HINT.body, /right-click/i)
    const library = HELP_SECTIONS.find((s) => s.id === 'library')
    assert.ok(library)
    assert.match((library.paragraphs ?? []).join(' '), /right-click/i)
  })

  it('tools section documents scan for installed games', () => {
    const section = HELP_SECTIONS.find((s) => s.id === 'tools')
    assert.ok(section)
    const body = (section.paragraphs ?? []).join(' ')
    assert.match(body, /Scan for installed games/i)
    assert.match(body, /install scan folders|Install scan folders/i)
    assert.match(body, /steam_appid\.txt/i)
  })
})
