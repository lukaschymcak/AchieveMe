import { shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { getDb } from '../db/database'
import { getGame } from '../db/repository'
import { loadSettings } from '../settings'
import { validateLudusaviPath, findTitleBySteamId } from '../achievement/ludusaviService'
import { normalizeOpenableAbsolutePath, dirnameOfPath } from '../../shared/libraryContextMenuUtils'
import { resolveGameRoot } from '../achievement/gameLaunchUtils'

/**
 * Resolves DepotDownloader `-dir` from a possibly deep install/DLL path.
 *
 * @param installPath - Stored install path (often steam_api.dll folder).
 * @param gameName - Library game title for folder-name matching.
 */
export function resolveDepotOutputDir(installPath: string, gameName: string): string {
  const resolved = resolveGameRoot(installPath, gameName)
  if (resolved.status === 'confident') return resolved.root
  if (resolved.status === 'unsure') return resolved.candidatePath
  return path.resolve(installPath)
}

/**
 * Opens a directory in the OS file manager. On Windows, prefer explorer.exe because
 * shell.openPath is unreliable for folders (often no window / opens behind Electron).
 *
 * @param folder - Absolute existing directory path
 */
export async function openFolderInFileManager(folder: string): Promise<void> {
  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      execFile('explorer.exe', [folder], (error) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error('explorer.exe was not found.'))
          return
        }
        // explorer.exe often exits with code 1 even when it opened the folder
        resolve()
      })
    })
    return
  }

  const err = await shell.openPath(folder)
  if (err?.trim()) {
    throw new Error(err.trim())
  }
}

/**
 * Opens a path (file or folder) in the OS file manager.
 * Accepts one path or an ordered list of candidates (first existing wins).
 * Files open their parent directory.
 *
 * @param targetPath - One path string or array of candidate paths.
 */
export async function openPath(targetPath: string | string[]): Promise<void> {
  const rawList = Array.isArray(targetPath) ? targetPath : [targetPath]
  const candidates = rawList
    .map((value) => normalizeOpenableAbsolutePath(String(value ?? '')))
    .filter((value): value is string => Boolean(value))

  if (candidates.length === 0) throw new Error('Invalid path.')

  let lastMissing = ''
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (!fs.existsSync(resolved)) {
      lastMissing = resolved
      continue
    }
    const folder = fs.statSync(resolved).isDirectory() ? resolved : dirnameOfPath(resolved)
    if (!folder || !fs.existsSync(folder)) {
      lastMissing = folder || resolved
      continue
    }
    await openFolderInFileManager(folder)
    return
  }

  throw new Error(`Path was not found: ${lastMissing || candidates[0]}`)
}

/**
 * Validates the Ludusavi exe path from settings.
 * Returns `{ ok: true; exe }` or `{ ok: false; error }`.
 */
export function resolveLudusaviExeOrError(
  settings: ReturnType<typeof loadSettings>
): { ok: true; exe: string } | { ok: false; error: string } {
  const raw = String(settings.ludusaviPath || '').trim()
  if (!raw) return { ok: false, error: 'Set ludusavi.exe in Settings first.' }
  try {
    const exe = validateLudusaviPath(raw)
    return { ok: true, exe }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Resolves a Ludusavi game title from the DB row, then falls back to
 * `findTitleBySteamId` CLI lookup, then the game name.
 * Returns `{ ok: true; title }` or `{ ok: false; error }`.
 */
export async function resolveLudusaviTitleOrError(
  appid: string,
  exe: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const game = getGame(getDb(), appid)
  let title = String(game?.ludusavi_title || '').trim()
  if (!title) {
    try {
      title = (await findTitleBySteamId(exe, appid))?.trim() || ''
    } catch {
      title = ''
    }
  }
  if (!title) title = String(game?.name || '').trim()
  if (!title) return { ok: false, error: 'Ludusavi title not found for this game.' }
  return { ok: true, title }
}

/**
 * Validates AppID string format (numeric only).
 */
export function assertValidAppid(
  raw: unknown
): { ok: true; clean: string } | { ok: false; error: string } {
  const clean = String(raw || '').trim()
  if (!/^\d+$/.test(clean)) return { ok: false, error: 'Invalid AppID.' }
  return { ok: true, clean }
}
