/**
 * Process list parsing and path helpers for playtime matching.
 * Pure — no Electron / Node child_process.
 */

export type ProcessInfo = {
  readonly pid: number
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
 * Parses PowerShell CIM `ProcessId\tExecutablePath` lines (or CSV-ish `pid,path`).
 * Skips rows with missing pid or empty executable path.
 *
 * @param text - Raw command stdout
 */
export const parseCimProcessList = (text: string): ProcessInfo[] => {
  const results: ProcessInfo[] = []
  const seen = new Set<number>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^processid\b/i.test(line) || /^pid\b/i.test(line)) continue

    let pidStr = ''
    let exePath = ''

    if (line.includes('\t')) {
      const [pidPart, ...rest] = line.split('\t')
      pidStr = (pidPart ?? '').trim()
      exePath = rest.join('\t').trim()
    } else {
      const comma = line.indexOf(',')
      if (comma <= 0) continue
      pidStr = line.slice(0, comma).trim()
      exePath = line.slice(comma + 1).trim().replace(/^"|"$/g, '')
    }

    const pid = Number(pidStr)
    if (!Number.isInteger(pid) || pid <= 0) continue
    if (!exePath) continue
    if (seen.has(pid)) continue
    seen.add(pid)
    results.push({ pid, executablePath: exePath })
  }

  return results
}
