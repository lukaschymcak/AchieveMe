import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { GameExecutable } from '../../shared/types'
import { rankGameExecutables } from '../../shared/gameExecutableRanking.ts'

/** Error code thrown when Play cannot launch until the user picks an exe. */
export const LAUNCH_NEEDS_EXE = 'LAUNCH_NEEDS_EXE' as const

/** Soft cap so huge trees cannot hang the UI. */
export const MAX_LISTED_EXECUTABLES = 200

/** Max parent folders to climb from the DLL / install path. */
export const MAX_ROOT_CLIMB = 12

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'to',
  'for',
  'in',
  'on'
])

/**
 * Result of climbing from an install/DLL path toward a game-named folder.
 */
export type GameRootResolveResult =
  | { status: 'confident'; root: string }
  | { status: 'unsure'; candidatePath: string }
  | { status: 'none' }

/**
 * Folder-name match strength against the Steam game title.
 */
export type FolderNameMatch = 'confident' | 'unsure' | 'none'

/**
 * Lowercases, strips punctuation, and collapses whitespace.
 *
 * @param value - Raw folder or game name.
 */
export function normalizeNameForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Returns alphanumeric tokens from a name.
 *
 * @param value - Raw name.
 */
export function nameTokens(value: string): string[] {
  const normalized = normalizeNameForCompare(value)
  if (!normalized) return []
  return normalized.split(' ')
}

/**
 * Significant tokens with common stop-words removed.
 *
 * @param value - Raw game name.
 */
export function significantNameTokens(value: string): string[] {
  return nameTokens(value).filter((token) => !STOP_WORDS.has(token))
}

function compactName(value: string): string {
  return normalizeNameForCompare(value).replace(/\s+/g, '')
}

/**
 * Builds an acronym from tokens (digits kept whole, else first letter).
 *
 * @param tokens - Name tokens.
 */
export function tokensToAcronym(tokens: string[]): string {
  return tokens
    .map((token) => (/^\d+$/.test(token) ? token : token[0] ?? ''))
    .join('')
}

/**
 * True when `folderCompact` matches a subsequence of token initials (e.g. P5X).
 *
 * @param folderCompact - Compact folder name.
 * @param tokens - Game name tokens.
 */
export function isAcronymSubsequence(folderCompact: string, tokens: string[]): boolean {
  if (folderCompact.length < 2 || folderCompact.length > 12) return false
  let fi = 0
  for (const token of tokens) {
    if (fi >= folderCompact.length) break
    if (/^\d+$/.test(token)) {
      if (folderCompact.slice(fi).startsWith(token)) {
        fi += token.length
      }
      continue
    }
    if (folderCompact[fi] === token[0]) {
      fi += 1
    }
  }
  return fi === folderCompact.length
}

/**
 * Classifies how well a folder basename matches a game title.
 *
 * @param folderName - Single path segment.
 * @param gameName - Steam / library game name.
 */
export function classifyFolderNameMatch(folderName: string, gameName: string): FolderNameMatch {
  const nFolder = normalizeNameForCompare(folderName)
  const nGame = normalizeNameForCompare(gameName)
  if (!nFolder || !nGame) return 'none'

  const cFolder = compactName(folderName)
  const cGame = compactName(gameName)

  if (cFolder === cGame) return 'confident'

  if (cFolder.includes(cGame) || cGame.includes(cFolder)) {
    const shorter = Math.min(cFolder.length, cGame.length)
    const longer = Math.max(cFolder.length, cGame.length)
    const ratio = shorter / longer
    // When the folder name is longer than the game name, it may be a data
    // subfolder (e.g. "GameName_Data"). Use a tighter threshold so we don't
    // stop the climb prematurely.
    const confidentThreshold = cFolder.length > cGame.length ? 0.85 : 0.5
    if (ratio >= confidentThreshold) return 'confident'
    if (shorter >= 3) return 'unsure'
  }

  const significant = significantNameTokens(gameName)
  const allTokens = nameTokens(gameName)
  const acronymSig = tokensToAcronym(significant)
  const acronymAll = tokensToAcronym(allTokens)

  if (cFolder === acronymSig || cFolder === acronymAll) return 'unsure'
  if (isAcronymSubsequence(cFolder, significant) || isAcronymSubsequence(cFolder, allTokens)) {
    return 'unsure'
  }

  return 'none'
}

/**
 * Walks up from `installPath` until a folder name matches the game name.
 *
 * @param installPath - Usually the steam DLL directory (may be deep).
 * @param gameName - Library game title.
 */
export function resolveGameRoot(installPath: string, gameName: string): GameRootResolveResult {
  let current = path.resolve(installPath)
  let unsurePath: string | null = null

  for (let i = 0; i < MAX_ROOT_CLIMB; i++) {
    const base = path.basename(current)
    const match = classifyFolderNameMatch(base, gameName)
    if (match === 'confident') {
      return { status: 'confident', root: current }
    }
    if (match === 'unsure' && !unsurePath) {
      unsurePath = current
    }

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  if (unsurePath) {
    return { status: 'unsure', candidatePath: unsurePath }
  }
  return { status: 'none' }
}

/**
 * Recursively lists `.exe` files under an install / game-root folder.
 * When `gameName` is provided, results are ranked (suggested first).
 *
 * @param installPath - Absolute directory to scan.
 * @param gameName - Optional library title for ranking.
 * @returns Executable entries with display name and relative paths.
 */
export function listInstallExecutables(installPath: string, gameName?: string): GameExecutable[] {
  const resolved = path.resolve(installPath)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return []
  }

  const results: GameExecutable[] = []

  const walk = (dir: string, relativeDir: string): void => {
    if (results.length >= MAX_LISTED_EXECUTABLES) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= MAX_LISTED_EXECUTABLES) return

      const absolutePath = path.join(dir, entry.name)
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name

      if (entry.isFile()) {
        if (!entry.name.toLowerCase().endsWith('.exe')) continue
        results.push({
          name: entry.name,
          relativePath,
          absolutePath
        })
        continue
      }

      if (entry.isDirectory()) {
        walk(absolutePath, relativePath)
      }
    }
  }

  walk(resolved, '')

  const ranked = rankGameExecutables(results, gameName?.trim() ?? '')
  return ranked.map(({ name, relativePath, absolutePath, suggested }) => ({
    name,
    relativePath,
    absolutePath,
    suggested
  }))
}

/**
 * Returns lowercase process base names (no `.exe`) for playtime matching.
 * When `gameName` is set, prefers a confidently (or unsure) resolved game root.
 *
 * @param installPath - Absolute install / DLL directory.
 * @param gameName - Optional library game title for root climb.
 */
export function listExeBaseNamesForPlaytime(installPath: string, gameName?: string): string[] {
  let scanRoot = installPath
  if (gameName?.trim()) {
    const resolved = resolveGameRoot(installPath, gameName)
    if (resolved.status === 'confident') {
      scanRoot = resolved.root
    } else if (resolved.status === 'unsure') {
      scanRoot = resolved.candidatePath
    }
  }

  return listInstallExecutables(scanRoot, gameName).map((exe) =>
    path.parse(exe.name).name.toLowerCase()
  )
}

/** Result of launching a game executable. */
export type LaunchGameExeResult = {
  readonly pid?: number
  readonly usedOpenPath: boolean
}

/** Options for {@link launchGameExe}. */
export type LaunchGameExeOptions = {
  /** Argv after the executable (from tokenizeLaunchArgs). */
  args?: string[]
  /** ShellExecute fallback used only on spawn EACCES. */
  openPath?: (filePath: string) => Promise<string>
  /** Test seam replacing `child_process.spawn`. */
  spawnImpl?: typeof spawn
}

/**
 * Launches a game executable detached from AchieveMe.
 * Prefers `spawn` (args + PID). On EACCES only, falls back to ShellExecute
 * (`openPath`) so UAC admin exes still start — args are ignored on that path.
 *
 * @param absolutePath - Absolute path to a `.exe` file.
 * @param options - Args, openPath fallback, optional spawn seam.
 * @throws If the file is missing, is not an `.exe`, or launch fails.
 */
export async function launchGameExe(
  absolutePath: string,
  options: LaunchGameExeOptions = {}
): Promise<LaunchGameExeResult> {
  const { args = [], openPath, spawnImpl = spawn } = options
  const resolved = path.resolve(absolutePath)
  const lower = resolved.toLowerCase()
  if (!lower.endsWith('.exe')) {
    throw new Error('Launch path must be a .exe file.')
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Executable was not found: ${resolved}`)
  }

  try {
    const pid = await spawnDetached(resolved, args, spawnImpl)
    return { pid, usedOpenPath: false }
  } catch (err) {
    if (!isEaccesError(err) || !openPath) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  const shellError = await openPath(resolved)
  if (shellError?.trim()) {
    throw new Error(shellError.trim())
  }
  return { usedOpenPath: true }
}

/**
 * Spawns a detached child and resolves with its PID on successful spawn.
 *
 * @param resolved - Absolute exe path
 * @param args - Argv
 * @param spawnImpl - spawn implementation
 */
function spawnDetached(
  resolved: string,
  args: string[],
  spawnImpl: typeof spawn
): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawnImpl(resolved, args, {
        cwd: path.dirname(resolved),
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })
    } catch (err) {
      reject(new Error(formatSpawnLaunchError(resolved, err)))
      return
    }

    child.on('error', (err) => {
      reject(new Error(formatSpawnLaunchError(resolved, err)))
    })

    child.on('spawn', () => {
      const pid = typeof child.pid === 'number' && child.pid > 0 ? child.pid : undefined
      child.unref()
      resolve(pid)
    })
  })
}

/**
 * @param err - Unknown spawn failure
 */
function isEaccesError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''
  const message = err instanceof Error ? err.message : String(err)
  return code === 'EACCES' || /\bEACCES\b/i.test(message)
}

/**
 * Maps spawn failures (especially EACCES for admin-required exes) to a clear message.
 *
 * @param exePath - Absolute path that failed to launch.
 * @param err - Error from the child process `error` event.
 */
export function formatSpawnLaunchError(exePath: string, err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''
  const message = err instanceof Error ? err.message : String(err)

  if (code === 'EACCES' || /\bEACCES\b/i.test(message)) {
    return (
      `Cannot launch "${path.basename(exePath)}" — Windows denied access (EACCES). ` +
      `This often means the executable is set to "Run as administrator". ` +
      `Approve the UAC prompt if shown, or clear that compatibility flag on the .exe, then try again.`
    )
  }

  return message || `Failed to launch ${exePath}`
}
