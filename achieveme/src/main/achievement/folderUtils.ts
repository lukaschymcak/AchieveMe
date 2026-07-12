import path from 'node:path'
import type { AppSettings, SourceId } from '../../shared/types'
import { encodePortablePath, SOURCE_FILE } from './savePathUtils'
import { collectFilesRecursive, getAppFolderPath, type CollectedFile } from './folderWalk'

export type { CollectedFile }
export { collectFilesRecursive, getAppFolderPath }

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
