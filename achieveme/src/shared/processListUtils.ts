/**
 * Process list parsing and path helpers for playtime matching.
 * Pure — no Electron / Node child_process.
 */

export type ProcessInfo = {
  readonly pid: number
  readonly name: string
  readonly executablePath: string
}

/** Basename (no extension) ignore list for under-root matching. */
export const PLAYTIME_IGNORED_BASENAMES = new Set([
  'achieveme',
  'electron',
  'depotdownloader',
  'steamless.cli',
  'ludusavi',
  'rclone',
  'dotnet',
  'unitycrashhandler64',
  'unitycrashhandler32',
  'crashreportclient',
  'crashpad_handler',
  'easyanticheat_eos',
  'vcredist_x64',
  'vcredist_x86',
  'vc_redist.x64',
  'vc_redist.x86',
  'dxsetup',
  'dxwebsetup'
])

/**
 * Normalizes a Windows path for case-insensitive equality and prefix checks.
 *
 * @param value - Absolute or relative path
 */
export const normalizePathForMatch = (value: string): string =>
  value.trim().replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

/**
 * Returns the lowercase basename without `.exe`.
 *
 * @param executablePath - Absolute path to an executable
 */
export const exeBasenameNoExt = (executablePath: string): string => {
  const normalized = normalizePathForMatch(executablePath)
  const base = normalized.split('\\').pop() ?? ''
  return base.endsWith('.exe') ? base.slice(0, -4) : base
}

/**
 * True when the basename is on the playtime ignore list.
 *
 * @param executablePath - Absolute path to an executable
 */
export const isIgnoredPlaytimeExe = (executablePath: string): boolean =>
  PLAYTIME_IGNORED_BASENAMES.has(exeBasenameNoExt(executablePath))

/**
 * True when a process image name (no path) is on the ignore list.
 *
 * @param name - ProcessName or exe basename
 */
export const isIgnoredPlaytimeName = (name: string): boolean =>
  PLAYTIME_IGNORED_BASENAMES.has(exeBasenameNoExt(name))

/**
 * Lowercase image name for matching: ProcessName, else basename of the path.
 *
 * @param process - Running process
 */
export const processImageName = (process: {
  readonly name?: string
  readonly executablePath: string
}): string => {
  const named = exeBasenameNoExt(process.name ?? '')
  if (named) return named
  return exeBasenameNoExt(process.executablePath)
}

/**
 * True when two paths refer to the same file (case / slash insensitive).
 *
 * @param a - First path
 * @param b - Second path
 */
export const pathsEqual = (a: string, b: string): boolean => {
  if (!a.trim() || !b.trim()) return false
  return normalizePathForMatch(a) === normalizePathForMatch(b)
}

/**
 * True when `childPath` is the root itself or a file/dir under `rootPath`.
 *
 * @param childPath - Candidate executable path
 * @param rootPath - Game install / resolved root
 */
export const isPathUnderRoot = (childPath: string, rootPath: string): boolean => {
  const child = normalizePathForMatch(childPath)
  const root = normalizePathForMatch(rootPath)
  if (!child || !root) return false
  return child === root || child.startsWith(`${root}\\`)
}

/**
 * Parses PowerShell process rows: `pid\tpath` or `pid\tname\tpath`.
 * Keeps empty paths so Play PIDs and hidden-path processes still match.
 *
 * @param text - Raw command stdout
 */
export const parseProcessList = (text: string): ProcessInfo[] => {
  const results: ProcessInfo[] = []
  const seen = new Set<number>()

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    // Keep trailing tabs so `pid\t` / `pid\tname\t` is not collapsed.
    const line = rawLine.replace(/^\s+/, '')
    if (/^processid\b/i.test(line) || /^pid\b/i.test(line)) continue
    const hasTab = line.includes('\t')
    const hasBacktickT = line.includes('`t')
    if (!hasTab && !hasBacktickT) continue

    const parts = hasTab ? line.split('\t') : line.split('`t')
    const pidStr = (parts[0] ?? '').trim()
    let nameRaw = ''
    let exePath = ''
    if (parts.length >= 3) {
      nameRaw = (parts[1] ?? '').trim()
      exePath = parts.slice(2).join(hasTab ? '\t' : '`t').trim()
    } else {
      exePath = (parts[1] ?? '').trim()
    }

    const pid = Number(pidStr)
    if (!Number.isInteger(pid) || pid <= 0) continue
    if (seen.has(pid)) continue
    seen.add(pid)
    const name = exeBasenameNoExt(nameRaw) || exeBasenameNoExt(exePath)
    results.push({ pid, name, executablePath: exePath })
  }

  return results
}

/**
 * Formats a process-list fetch error for logs.
 *
 * @param err - Thrown value from the process-list spawn
 */
export const formatProcessListError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'killed' in err && (err as { killed?: boolean }).killed) {
    return 'timeout'
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return String(err)
}
