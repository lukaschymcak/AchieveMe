import path from 'node:path'
import type { AppSettings, SourceId } from '../../shared/types'
import { encodePortablePath, SOURCE_FILE } from './savePathUtils'
import { collectFilesRecursive, getAppFolderPath, type CollectedFile } from './folderWalk'

export type { CollectedFile }
export { collectFilesRecursive, getAppFolderPath }

/** Root-level Goldberg/GSE folders included in full ZIP backup (not appid folders). */
export const EMULATOR_ROOT_BACKUP_DIRS = ['settings'] as const

/** Portable path hint for a folder directly under an emulator root (e.g. settings/). */
export function encodePortableRootSubfolder(
  folderPath: string,
  relativeFromRoot: string,
  source: SourceId,
  settings: AppSettings
): ReturnType<typeof encodePortablePath> {
  const probePath = path.join(folderPath, '.achieveme-probe')
  const hint = encodePortablePath(probePath, source, settings)
  return {
    ...hint,
    relativePath: relativeFromRoot.replace(/\\/g, '/')
  }
}

/** Portable path hint for an appid folder (relativePath = folder name under root). */
export function encodePortableFolderPath(
  folderPath: string,
  source: SourceId,
  settings: AppSettings
): ReturnType<typeof encodePortablePath> {
  const achievementPath = path.join(folderPath, SOURCE_FILE[source])
  const hint = encodePortablePath(achievementPath, source, settings)
  return {
    ...hint,
    relativePath: path.basename(folderPath)
  }
}
