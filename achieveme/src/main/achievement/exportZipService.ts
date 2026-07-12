import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type Database from 'better-sqlite3'
import type { AppSettings, FullBackupManifest, PortableFolder } from '../../shared/types'
import { getAllSaveLocations } from '../db/repository'
import { buildExportBundle } from './exportService'
import { discoverUncoveredGoldbergSaves } from './exportDiscovery'
import { collectFilesRecursive, encodePortableFolderPath, encodePortableRootSubfolder, EMULATOR_ROOT_BACKUP_DIRS, getAppFolderPath } from './folderUtils'
import { GOLDBERG_JSON_SOURCES, getRootsForSource } from './savePathUtils'

function folderKey(source: string, appid: string, folderPath: string): string {
  return `${source}|${appid}|${folderPath.toLowerCase()}`
}

function collectEmulatorRootFolders(
  settings: AppSettings
): Array<{ folderPath: string; folder: PortableFolder }> {
  const results: Array<{ folderPath: string; folder: PortableFolder }> = []
  const seen = new Set<string>()

  for (const source of GOLDBERG_JSON_SOURCES) {
    if (!settings.enabledSources.includes(source)) continue

    for (const root of getRootsForSource(source, settings)) {
      if (!root || !fs.existsSync(root)) continue

      for (const dirName of EMULATOR_ROOT_BACKUP_DIRS) {
        const folderPath = path.join(root, dirName)
        const key = folderKey(source, dirName, folderPath)
        if (seen.has(key)) continue
        if (!fs.existsSync(folderPath)) continue
        seen.add(key)

        const hint = encodePortableRootSubfolder(folderPath, dirName, source, settings)
        const archivePath = `saves/${source}/${dirName}`.replace(/\\/g, '/')
        results.push({
          folderPath,
          folder: {
            appid: dirName,
            source,
            rootKind: hint.rootKind,
            rootSource: hint.rootSource,
            customRoot: hint.customRoot || undefined,
            relativePath: hint.relativePath,
            archivePath
          }
        })
      }
    }
  }

  return results
}

function collectFolders(
  db: Database.Database,
  settings: AppSettings
): Array<{ folderPath: string; folder: PortableFolder }> {
  const results: Array<{ folderPath: string; folder: PortableFolder }> = []
  const seen = new Set<string>()

  for (const loc of getAllSaveLocations(db)) {
    if (!GOLDBERG_JSON_SOURCES.includes(loc.source)) continue

    const folderPath = getAppFolderPath(loc.file_path)
    const key = folderKey(loc.source, loc.appid, folderPath)
    if (seen.has(key)) continue
    seen.add(key)

    const hint = encodePortableFolderPath(folderPath, loc.source, settings)
    const archivePath = `saves/${loc.source}/${loc.appid}`.replace(/\\/g, '/')
    results.push({
      folderPath,
      folder: {
        appid: loc.appid,
        source: loc.source,
        rootKind: hint.rootKind,
        rootSource: hint.rootSource,
        customRoot: hint.customRoot || undefined,
        relativePath: hint.relativePath,
        archivePath
      }
    })
  }

  for (const discovered of discoverUncoveredGoldbergSaves(
    settings,
    seen,
    (d) => folderKey(d.source, d.appid, getAppFolderPath(d.filePath))
  )) {
    const folderPath = getAppFolderPath(discovered.filePath)
    const hint = encodePortableFolderPath(folderPath, discovered.source, settings)
    const archivePath = `saves/${discovered.source}/${discovered.appid}`.replace(/\\/g, '/')
    results.push({
      folderPath,
      folder: {
        appid: discovered.appid,
        source: discovered.source,
        rootKind: hint.rootKind,
        rootSource: hint.rootSource,
        customRoot: hint.customRoot || undefined,
        relativePath: hint.relativePath,
        archivePath
      }
    })
  }

  results.push(...collectEmulatorRootFolders(settings))

  return results
}

export function buildFullBackupZip(
  db: Database.Database,
  settings: AppSettings,
  outputPath: string
): void {
  const bundle = buildExportBundle(db, settings)
  const folderEntries = collectFolders(db, settings)

  const manifest: FullBackupManifest = {
    formatVersion: 3,
    exportedAt: bundle.exportedAt,
    games: bundle.games,
    achievements: bundle.achievements,
    folders: folderEntries.map((e) => e.folder)
  }

  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))

  for (const { folderPath, folder } of folderEntries) {
    if (!fs.existsSync(folderPath)) continue

    for (const file of collectFilesRecursive(folderPath)) {
      const zipPath = `${folder.archivePath}/${file.relativePath}`.replace(/\\/g, '/')
      zip.addFile(zipPath, fs.readFileSync(file.absolutePath))
    }
  }

  zip.writeZip(outputPath)
}
