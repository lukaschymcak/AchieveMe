/**
 * Pure helpers for scanning disk roots for Steam-shaped game installs.
 * No Electron / fs — safe for the Node test runner.
 */

/** Skip these directory basenames during install scans (case-insensitive). */
export const SCAN_SKIP_DIR_NAMES = new Set([
  'windows',
  'node_modules',
  '$recycle.bin',
  '.git',
  'system volume information'
])

/** Default Games-style roots considered by proposeInstallScanRoots. */
export const DEFAULT_GAMES_ROOT_CANDIDATES = [
  'C:\\Games',
  'D:\\Games',
  'E:\\Games'
] as const

export interface ScannedInstallCandidateBase {
  appid: string
  guessedName: string
  installPath: string
  suggestedExe: string
}

/**
 * Parses steam_appid.txt file contents into a numeric AppID string.
 *
 * @param contents - Raw file text
 * @returns AppID digits, or null if invalid
 */
export const parseSteamAppIdTxt = (contents: string): string | null => {
  const line = contents
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!line) return null
  if (!/^\d+$/.test(line)) return null
  return line
}

/**
 * True when a scan root must be refused (drive root or Windows folder).
 * Accepts paths with `/` or `\`; comparison is case-insensitive on Windows-style paths.
 *
 * @param absPath - Absolute path candidate
 */
export const isRefusedScanRoot = (absPath: string): boolean => {
  const trimmed = absPath.trim()
  if (!trimmed) return true
  const normalized = trimmed.replace(/\//g, '\\').replace(/\\+$/, '')
  // Drive root: C: or C:\
  if (/^[a-zA-Z]:$/i.test(normalized)) return true
  if (/^[a-zA-Z]:\\$/i.test(trimmed.replace(/\//g, '\\'))) return true
  // X:\Windows (any drive)
  if (/^[a-zA-Z]:\\Windows$/i.test(normalized)) return true
  return false
}

/**
 * True when a directory basename should be skipped during walk.
 *
 * @param name - Single path segment
 */
export const shouldSkipScanDirName = (name: string): boolean => {
  const lower = name.trim().toLowerCase()
  if (!lower) return true
  return SCAN_SKIP_DIR_NAMES.has(lower)
}

/**
 * Returns default install-scan roots that currently exist on disk.
 *
 * @param existsFn - Sync existence check (injectable for tests)
 * @param steamCommonPaths - Optional Steam `steamapps\\common` candidates to include when present
 */
export const proposeInstallScanRoots = (
  existsFn: (p: string) => boolean,
  steamCommonPaths: string[] = []
): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed || isRefusedScanRoot(trimmed)) return
    const key = trimmed.replace(/\//g, '\\').toLowerCase()
    if (seen.has(key)) return
    if (!existsFn(trimmed)) return
    seen.add(key)
    out.push(trimmed.replace(/\//g, '\\').replace(/\\+$/, ''))
  }
  for (const root of DEFAULT_GAMES_ROOT_CANDIDATES) push(root)
  for (const root of steamCommonPaths) push(root)
  return out
}

/**
 * Guessed display name from an install folder path and detection mode.
 * Numeric AppID folders use the parent folder name when available.
 *
 * @param installPath - Absolute install folder
 * @param appid - Detected AppID
 */
export const guessNameFromInstallPath = (installPath: string, appid: string): string => {
  const normalized = installPath.replace(/\//g, '\\').replace(/\\+$/, '')
  const base = normalized.split('\\').pop() || ''
  if (base === appid) {
    const parts = normalized.split('\\').filter(Boolean)
    if (parts.length >= 2) {
      const parent = parts[parts.length - 2]
      if (parent && !/^[a-zA-Z]:$/i.test(parent)) return parent
    }
  }
  return base || `App ${appid}`
}

/**
 * Deduplicate scan candidates by AppID (first wins).
 *
 * @param candidates - Raw candidate list
 */
export const dedupeScanCandidates = <T extends { appid: string }>(candidates: T[]): T[] => {
  const seen = new Set<string>()
  const out: T[] = []
  for (const c of candidates) {
    const id = String(c.appid || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(c)
  }
  return out
}

/**
 * True when folder basename is a numeric AppID folder.
 *
 * @param dirName - Directory basename
 */
export const isNumericAppIdFolderName = (dirName: string): boolean => /^\d+$/.test(dirName.trim())

/**
 * True when a filename is steam_api.dll or steam_api64.dll.
 *
 * @param fileName - File basename
 */
export const isSteamApiDllFileName = (fileName: string): boolean => {
  const lower = fileName.trim().toLowerCase()
  return lower === 'steam_api.dll' || lower === 'steam_api64.dll'
}
