/**
 * Pure helpers for library game context-menu actions (open folder, play label).
 * No Electron / fs — safe for the Node test runner.
 */

/**
 * Returns the folder to open in Explorer for a library game, or null if none.
 * Prefers `installPath`; otherwise `dirname(launchExe)`.
 *
 * @param installPath - Stored install / DLL folder
 * @param launchExe - Absolute Play executable path
 */
export const resolveLibraryOpenFolder = (
  installPath: string,
  launchExe: string
): string | null => {
  const candidates = listLibraryOpenFolderCandidates(installPath, launchExe)
  return candidates[0] ?? null
}

/**
 * Ordered folder candidates for Open folder (install path first, then exe dirname).
 * Main tries each until one exists on disk.
 *
 * @param installPath - Stored install / DLL folder
 * @param launchExe - Absolute Play executable path
 */
export const listLibraryOpenFolderCandidates = (
  installPath: string,
  launchExe: string
): string[] => {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (value: string): void => {
    const normalized = normalizeFolderPath(value)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(normalized)
  }

  const install = installPath.trim()
  if (install) push(install)

  const exe = launchExe.trim()
  if (exe) {
    const dir = dirnameOfPath(exe)
    if (dir) push(dir)
  }

  return out
}

/**
 * True when Open folder should appear in the context menu.
 *
 * @param installPath - Stored install path
 * @param launchExe - Stored launch exe
 */
export const shouldShowOpenFolder = (installPath: string, launchExe: string): boolean =>
  listLibraryOpenFolderCandidates(installPath, launchExe).length > 0

/**
 * Label for the Play menu item / button.
 *
 * @param hasExe - Whether `launch_exe` is set
 * @param launching - Whether a launch is in flight
 */
export const playMenuLabel = (hasExe: boolean, launching: boolean): string => {
  if (launching) return 'Starting…'
  if (hasExe) return 'Play'
  return 'Set up Play'
}

/**
 * Validates a path string that main may open via shell.openPath.
 * Does not check filesystem existence (main does that).
 *
 * @param value - Candidate absolute path
 * @returns Normalized absolute path, or null if rejected
 */
export const normalizeOpenableAbsolutePath = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Reject relative / empty drive-relative junk
  if (trimmed.startsWith('.') || trimmed.startsWith('..')) return null
  const hasUnixRoot = trimmed.startsWith('/')
  const hasWinRoot = /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')
  if (!hasUnixRoot && !hasWinRoot) return null
  return normalizeFolderPath(trimmed)
}

/**
 * Parent directory of a file path (supports `\` and `/`).
 *
 * @param filePath - Absolute or relative file path
 */
export const dirnameOfPath = (filePath: string): string => {
  const normalized = filePath.replace(/\//g, '\\').replace(/\\+$/, '')
  const idx = normalized.lastIndexOf('\\')
  if (idx <= 0) return ''
  // Keep Windows drive root like C:\
  if (idx === 2 && /^[a-zA-Z]:$/i.test(normalized.slice(0, 2))) {
    return normalized.slice(0, 3)
  }
  return normalized.slice(0, idx)
}

/**
 * @param value - Path to normalize separators without collapsing UNC carefully
 */
const normalizeFolderPath = (value: string): string =>
  value.replace(/\//g, '\\').replace(/\\+$/, '') || value
