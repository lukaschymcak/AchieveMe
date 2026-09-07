import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import type { GameExecutable, ScannedInstallCandidate } from '../../shared/types'
import {
  dedupeScanCandidates,
  guessNameFromInstallPath,
  isNumericAppIdFolderName,
  isRefusedScanRoot,
  isSteamApiDllFileName,
  parseSteamAppIdTxt,
  shouldSkipScanDirName
} from '../../shared/installedGamesScanUtils.ts'
import { walkDirsBounded } from './folderWalk.ts'
import { listInstallExecutables } from './gameLaunchUtils.ts'
import { getGame, isAppidIgnored } from '../db/repository.ts'

export interface ScanInstalledGamesOptions {
  includeIgnored?: boolean
  getGameByAppid?: (appid: string) => { name: string; install_path: string } | undefined
  isIgnored?: (appid: string) => boolean
  listExes?: (installPath: string, gameName: string) => GameExecutable[]
  readFile?: (filePath: string) => string
  listDirNames?: (dirPath: string) => string[]
}

/**
 * Walks install roots and returns Steam-shaped game candidates (no DB writes).
 *
 * @param roots - Absolute roots to scan
 * @param options - Ignore filter and injectable seams for tests
 */
export function scanInstalledGames(
  roots: string[],
  options: ScanInstalledGamesOptions = {}
): ScannedInstallCandidate[] {
  const includeIgnored = Boolean(options.includeIgnored)
  const listExes = options.listExes ?? listInstallExecutables
  const readFile =
    options.readFile ??
    ((filePath: string) => fs.readFileSync(filePath, 'utf8'))
  const listDirNames =
    options.listDirNames ??
    ((dirPath: string) => {
      try {
        return fs.readdirSync(dirPath)
      } catch {
        return []
      }
    })

  const raw: ScannedInstallCandidate[] = []

  for (const root of roots) {
    const trimmed = String(root || '').trim()
    if (!trimmed || isRefusedScanRoot(trimmed)) continue
    if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isDirectory()) continue

    const dirs = walkDirsBounded(trimmed, {
      maxDepth: 4,
      maxDirs: 5000,
      shouldSkip: shouldSkipScanDirName
    })

    for (const dir of dirs) {
      const detected = detectInstallInDir(dir, { readFile, listDirNames })
      if (!detected) continue

      const guessedName = guessNameFromInstallPath(detected.installPath, detected.appid)
      const exes = listExes(detected.installPath, guessedName)
      const suggested = exes.find((e) => e.suggested)?.absolutePath ?? ''

      raw.push({
        appid: detected.appid,
        guessedName,
        installPath: detected.installPath,
        suggestedExe: suggested,
        alreadyInLibrary: false,
        ignored: false
      })
    }
  }

  const deduped = dedupeScanCandidates(raw)
  const out: ScannedInstallCandidate[] = []

  for (const c of deduped) {
    const existing = options.getGameByAppid?.(c.appid)
    const ignored = options.isIgnored?.(c.appid) ?? false
    if (ignored && !includeIgnored) continue
    out.push({
      ...c,
      guessedName: existing?.name?.trim() || c.guessedName,
      alreadyInLibrary: Boolean(existing),
      ignored
    })
  }

  return out
}

/**
 * Scan using live DB for library / ignore state.
 *
 * @param db - Open SQLite database
 * @param roots - Roots to walk
 * @param includeIgnored - Include ignored AppIDs
 */
export function scanInstalledGamesWithDb(
  db: Database.Database,
  roots: string[],
  includeIgnored = false
): ScannedInstallCandidate[] {
  return scanInstalledGames(roots, {
    includeIgnored,
    getGameByAppid: (appid) => {
      const g = getGame(db, appid)
      if (!g) return undefined
      return { name: g.name, install_path: g.install_path }
    },
    isIgnored: (appid) => isAppidIgnored(db, appid)
  })
}

/**
 * Validates an install folder before DB upsert (IPC / callers).
 *
 * @param installPath - Absolute path
 */
export function assertScannedInstallPath(installPath: string): string {
  const resolved = path.resolve(String(installPath || '').trim())
  if (!resolved || isRefusedScanRoot(resolved)) {
    throw new Error('That folder cannot be used as an install path.')
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Install folder was not found: ${resolved}`)
  }
  return resolved
}

function detectInstallInDir(
  dir: string,
  deps: {
    readFile: (filePath: string) => string
    listDirNames: (dirPath: string) => string[]
  }
): { appid: string; installPath: string } | null {
  const appidTxt = path.join(dir, 'steam_appid.txt')
  if (fs.existsSync(appidTxt)) {
    try {
      const appid = parseSteamAppIdTxt(deps.readFile(appidTxt))
      if (appid) return { appid, installPath: dir }
    } catch {
      // ignore unreadable
    }
  }

  const base = path.basename(dir)
  if (!isNumericAppIdFolderName(base)) return null

  const names = deps.listDirNames(dir)
  const hasDll = names.some((n) => isSteamApiDllFileName(n))
  if (!hasDll) return null
  return { appid: base.trim(), installPath: dir }
}
