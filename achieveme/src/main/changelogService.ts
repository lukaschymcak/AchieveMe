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

export function getSettingsFilePath(baseDir?: string): string {
  const dir = baseDir ?? (app ? app.getPath('userData') : '')
  return path.join(dir, 'settings.json')
}

export function readStoredLastSeenVersion(baseDir?: string): string | undefined {
  try {
    const filePath = getSettingsFilePath(baseDir)
    if (!fs.existsSync(filePath)) return undefined
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as { lastSeenVersion?: string }
    return typeof parsed?.lastSeenVersion === 'string' ? parsed.lastSeenVersion : undefined
  } catch {
    return undefined
  }
}

export function updateStoredLastSeenVersion(version: string, baseDir?: string): void {
  try {
    const filePath = getSettingsFilePath(baseDir)
    let current: Record<string, unknown> = {}
    if (fs.existsSync(filePath)) {
      try {
        current = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
      } catch {
        current = {}
      }
    }
    current.lastSeenVersion = version
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8')
  } catch (err) {
    console.warn('[changelogService] Failed to update lastSeenVersion:', err)
  }
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
 * Checks for a pending changelog on startup from a locally saved file.
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
 * Fetches release notes or commit messages from GitHub.
 * Queries the release tag first; falls back to recent commits.
 */
export async function fetchChangelogFromGitHub(version: string): Promise<PendingChangelog | null> {
  const cleanVersion = version.replace(/^v/, '').trim()
  if (!cleanVersion) return null

  // 1. Try to fetch release by tag
  try {
    const res = await fetch(
      `https://api.github.com/repos/lukaschymcak/AchieveMe/releases/tags/v${cleanVersion}`,
      {
        headers: {
          'User-Agent': `AchieveMe/${cleanVersion}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    if (res.ok) {
      const data = (await res.json()) as { body?: string; published_at?: string }
      if (data.body && data.body.trim()) {
        return {
          version: cleanVersion,
          notes: data.body.trim(),
          releaseDate: data.published_at
        }
      }
    }
  } catch (err) {
    console.warn('[changelogService] Failed to fetch release from GitHub:', err)
  }

  // 2. Fallback: Fetch recent commit messages from repository
  try {
    const res = await fetch(
      'https://api.github.com/repos/lukaschymcak/AchieveMe/commits?per_page=12',
      {
        headers: {
          'User-Agent': `AchieveMe/${cleanVersion}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    if (res.ok) {
      const commits = (await res.json()) as Array<{
        commit?: { message?: string; committer?: { date?: string } }
      }>
      if (Array.isArray(commits) && commits.length > 0) {
        const messages = commits
          .map((c) => (c.commit?.message || '').split('\n')[0].trim())
          .filter((msg) => msg.length > 0 && !msg.startsWith('Merge branch'))

        if (messages.length > 0) {
          return {
            version: cleanVersion,
            notes: messages.join('\n'),
            releaseDate: commits[0]?.commit?.committer?.date
          }
        }
      }
    }
  } catch (err) {
    console.warn('[changelogService] Failed to fetch commits fallback from GitHub:', err)
  }

  return null
}

/**
 * Ensures pending changelog is resolved and displayed once upon version upgrade.
 * Checks local pending file first; falls back to GitHub if version changed.
 */
export async function ensurePendingChangelog(
  currentVersion?: string,
  baseDir?: string,
  fetcher: (version: string) => Promise<PendingChangelog | null> = fetchChangelogFromGitHub
): Promise<PendingChangelog | null> {
  const version = currentVersion ?? (app ? app.getVersion() : '')
  const fromFile = checkPendingChangelog(version, baseDir)

  try {
    const lastSeen = readStoredLastSeenVersion(baseDir)

    if (fromFile) {
      updateStoredLastSeenVersion(version, baseDir)
      return fromFile
    }

    if (lastSeen === undefined) {
      // First install: record version without displaying update modal
      updateStoredLastSeenVersion(version, baseDir)
      return null
    }

    if (lastSeen !== version) {
      // Upgraded from previous version without pre-saved changelog file
      const fetched = await fetcher(version)
      updateStoredLastSeenVersion(version, baseDir)

      if (fetched) {
        cachedPendingChangelog = fetched
        return fetched
      }
    }
  } catch (err) {
    console.warn('[changelogService] Failed during ensurePendingChangelog:', err)
  }

  return fromFile
}

/**
 * Returns the in-memory cached pending changelog for the current session.
 */
export function getPendingChangelog(): PendingChangelog | null {
  return cachedPendingChangelog
}
