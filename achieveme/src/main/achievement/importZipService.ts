import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type Database from 'better-sqlite3'
import type { AppSettings, FullBackupManifest, ImportResult } from '../../shared/types'
import { upsertAchievements, upsertGame } from '../db/repository'
import { processAppId } from './processAppId'
import { regenerateProfileStats } from './profileStatsService'
import { resolvePortablePath } from './savePathUtils'
import type { ImportOptions } from './importService'

function isV3Manifest(data: unknown): data is FullBackupManifest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'formatVersion' in data &&
    (data as FullBackupManifest).formatVersion === 3 &&
    'folders' in data
  )
}

export async function importFullBackupZip(
  db: Database.Database,
  zipPath: string,
  settings: AppSettings,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const errors: string[] = []
  let filesWritten = 0

  const zip = new AdmZip(zipPath)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) {
    throw new Error('Invalid backup: manifest.json not found')
  }

  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'))
  if (!isV3Manifest(manifest)) {
    throw new Error('Invalid backup: expected formatVersion 3')
  }

  for (const game of manifest.games) {
    upsertGame(db, game)
  }
  upsertAchievements(db, manifest.achievements)

  const appidsToRefresh = new Set<string>()

  for (const folder of manifest.folders) {
    const hint = {
      rootKind: folder.rootKind,
      rootSource: folder.rootSource,
      customRoot: folder.customRoot ?? '',
      relativePath: folder.relativePath
    }

    let customRootOverride: string | undefined
    if (hint.rootKind === 'custom' && hint.customRoot) {
      if (!fs.existsSync(hint.customRoot)) {
        customRootOverride = options.customRootMap?.[hint.customRoot]
        if (!customRootOverride) {
          errors.push(
            `Skipped ${folder.appid}/${folder.source}: custom root missing (${hint.customRoot})`
          )
          continue
        }
      }
    }

    let folderRoot: string
    try {
      folderRoot = resolvePortablePath(hint, settings, { customRootOverride })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Skipped ${folder.appid}/${folder.source}: ${msg}`)
      continue
    }

    const prefix = `${folder.archivePath.replace(/\\/g, '/')}/`
    const entries = zip.getEntries().filter((e) => {
      const name = e.entryName.replace(/\\/g, '/')
      return name.startsWith(prefix) && !e.isDirectory
    })

    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, '/')
      const fileRelative = name.slice(prefix.length)
      if (!fileRelative) continue

      const targetPath = path.join(folderRoot, fileRelative.replace(/\//g, path.sep))

      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, entry.getData())
        filesWritten++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Failed ${folder.appid}/${fileRelative}: ${msg}`)
      }
    }

    if (/^\d+$/.test(folder.appid)) {
      appidsToRefresh.add(folder.appid)
    }
  }

  for (const appid of appidsToRefresh) {
    await processAppId(appid, settings, true)
  }

  regenerateProfileStats(db)

  return {
    gamesImported: manifest.games.length,
    saveFilesWritten: filesWritten,
    filesWritten,
    errors
  }
}
