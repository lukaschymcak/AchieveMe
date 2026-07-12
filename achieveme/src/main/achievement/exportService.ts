import fs from 'node:fs'
import type Database from 'better-sqlite3'
import type {
  AppSettings,
  Achievement,
  ExportBundleV2,
  GoldbergProgress,
  PortableSaveFile,
  RawAchievement
} from '../../shared/types'
import {
  getAllGames,
  getAchievementsForGame,
  getAllSaveLocations
} from '../db/repository'
import { discoverUncoveredGoldbergSaves } from './exportDiscovery'
import { parseGoldbergAchievements } from './parsers/goldbergParser'
import { encodePortablePath, GOLDBERG_JSON_SOURCES } from './savePathUtils'

function rawToGoldbergProgress(raw: Record<string, RawAchievement>): GoldbergProgress {
  const result: GoldbergProgress = {}
  for (const [apiName, ach] of Object.entries(raw)) {
    result[apiName] = { earned: ach.achieved, earned_time: ach.achieved ? ach.unlockTime : 0 }
  }
  return result
}

function achievementsToGoldbergProgress(achievements: Achievement[]): GoldbergProgress {
  const result: GoldbergProgress = {}
  for (const a of achievements) {
    result[a.api_name] = { earned: a.earned === 1, earned_time: a.earned_time }
  }
  return result
}

function readProgressForLocation(
  db: Database.Database,
  appid: string,
  filePath: string
): GoldbergProgress {
  if (fs.existsSync(filePath)) {
    return rawToGoldbergProgress(parseGoldbergAchievements(filePath))
  }
  return achievementsToGoldbergProgress(getAchievementsForGame(db, appid))
}

function locationToSaveFile(
  db: Database.Database,
  loc: ReturnType<typeof getAllSaveLocations>[number]
): PortableSaveFile {
  return {
    appid: loc.appid,
    source: loc.source,
    format: 'goldberg-json',
    rootKind: loc.root_kind,
    rootSource: loc.root_source,
    customRoot: loc.custom_root || undefined,
    relativePath: loc.relative_path,
    progress: readProgressForLocation(db, loc.appid, loc.file_path)
  }
}

export function buildExportBundle(db: Database.Database, settings: AppSettings): ExportBundleV2 {
  const games = getAllGames(db)
  const achievements = games.flatMap((g) => getAchievementsForGame(db, g.appid))

  const saveFiles: PortableSaveFile[] = []
  const covered = new Set<string>()

  for (const loc of getAllSaveLocations(db)) {
    if (!GOLDBERG_JSON_SOURCES.includes(loc.source)) continue
    saveFiles.push(locationToSaveFile(db, loc))
    covered.add(`${loc.appid}|${loc.source}|${loc.file_path.toLowerCase()}`)
  }

  for (const discovered of discoverUncoveredGoldbergSaves(
    settings,
    covered,
    (d) => `${d.appid}|${d.source}|${d.filePath.toLowerCase()}`
  )) {
    const hint = encodePortablePath(discovered.filePath, discovered.source, settings)
    saveFiles.push({
      appid: discovered.appid,
      source: discovered.source,
      format: 'goldberg-json',
      rootKind: hint.rootKind,
      rootSource: hint.rootSource,
      customRoot: hint.customRoot || undefined,
      relativePath: hint.relativePath,
      progress: readProgressForLocation(db, discovered.appid, discovered.filePath)
    })
  }

  return {
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    games,
    achievements,
    saveFiles
  }
}
