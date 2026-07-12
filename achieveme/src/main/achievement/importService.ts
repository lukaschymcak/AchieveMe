import fs from 'node:fs'
import type Database from 'better-sqlite3'
import type {
  AppSettings,
  ExportBundleV2,
  GoldbergProgress,
  ImportResult,
  RawAchievement
} from '../../shared/types'
import { upsertGame, upsertAchievements, upsertSaveLocation } from '../db/repository'
import { processAppId } from './processAppId'
import { regenerateProfileStats } from './profileStatsService'
import { resolvePortablePath } from './savePathUtils'
import { writeSaveBySource } from './writers/writeBySource'

function goldbergProgressToRaw(progress: GoldbergProgress): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}
  for (const [apiName, p] of Object.entries(progress)) {
    result[apiName] = {
      achieved: p.earned,
      unlockTime: p.earned ? p.earned_time : 0
    }
  }
  return result
}

export async function importBundle(
  db: Database.Database,
  bundle: ExportBundleV2,
  settings: AppSettings
): Promise<ImportResult> {
  const errors: string[] = []
  let saveFilesWritten = 0

  for (const game of bundle.games) {
    upsertGame(db, game)
  }
  upsertAchievements(db, bundle.achievements)

  const appidsToRefresh = new Set<string>()

  for (const saveFile of bundle.saveFiles ?? []) {
    if (saveFile.format !== 'goldberg-json') continue

    try {
      const hint = {
        rootKind: saveFile.rootKind,
        rootSource: saveFile.rootSource,
        customRoot: saveFile.customRoot ?? '',
        relativePath: saveFile.relativePath
      }

      if (hint.rootKind === 'custom' && hint.customRoot && !fs.existsSync(hint.customRoot)) {
        errors.push(
          `Skipped ${saveFile.appid}/${saveFile.source}: custom root missing (${hint.customRoot})`
        )
        continue
      }

      const targetPath = resolvePortablePath(hint, settings)
      const raw = goldbergProgressToRaw(saveFile.progress)
      writeSaveBySource(saveFile.source, targetPath, raw)
      saveFilesWritten++

      const now = Math.floor(Date.now() / 1000)
      upsertSaveLocation(db, {
        appid: saveFile.appid,
        source: saveFile.source,
        file_path: targetPath,
        root_kind: hint.rootKind,
        root_source: hint.rootSource,
        custom_root: hint.customRoot,
        relative_path: hint.relativePath,
        updated_at: now
      })

      appidsToRefresh.add(saveFile.appid)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed ${saveFile.appid}/${saveFile.source}: ${msg}`)
    }
  }

  for (const appid of appidsToRefresh) {
    await processAppId(appid, settings, true)
  }

  regenerateProfileStats(db)

  return {
    gamesImported: bundle.games.length,
    saveFilesWritten,
    filesWritten: saveFilesWritten,
    errors
  }
}
