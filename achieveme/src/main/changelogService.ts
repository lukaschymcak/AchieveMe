import fs from 'node:fs'
import path from 'node:path'
import electron from 'electron'
import type { PendingChangelog } from '../shared/types'
import { resolvePendingChangelog } from '../shared/changelogUtils.ts'

const app = electron && typeof electron === 'object' && 'app' in electron ? electron.app : undefined

let cachedPendingChangelog: PendingChangelog | null = null

export function getPendingChangelogPath(baseDir?: string): string {
  const dir = baseDir ?? (app ? app.getPath('userData') : '')
  return path.join(dir, 'pending_changelog.json')
}

/**
 * Saves a pending changelog file when an update is downloaded.
 */
export function savePendingChangelog(payload: PendingChangelog, baseDir?: string): void {
  try {
    const filePath = getPendingChangelogPath(baseDir)
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    console.warn('[changelogService] Failed to save pending changelog:', err)
  }
}

/**
 * Checks for a pending changelog on startup.
 * If the recorded changelog matches the currently running app version,
 * removes the file, stores it in memory, and returns it.
 */
export function checkPendingChangelog(
  currentVersion?: string,
  baseDir?: string
): PendingChangelog | null {
  const filePath = getPendingChangelogPath(baseDir)
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const version = currentVersion ?? (app ? app.getVersion() : '')
    const resolved = resolvePendingChangelog(raw, version)

    if (resolved) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // Ignore file deletion errors
      }
      cachedPendingChangelog = resolved
      return resolved
    }
  } catch (err) {
    console.warn('[changelogService] Failed to check pending changelog:', err)
  }

  return null
}

/**
 * Returns the in-memory cached pending changelog for the current session.
 */
export function getPendingChangelog(): PendingChangelog | null {
  return cachedPendingChangelog
}
