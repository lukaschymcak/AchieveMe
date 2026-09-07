/**
 * Pure ranking and launch-arg helpers for Play executable selection.
 * No Electron / Node fs — safe for the Node test runner.
 */

export type RankableExecutable = {
  readonly name: string
  readonly relativePath: string
  readonly absolutePath: string
}

export type RankedExecutable = RankableExecutable & {
  readonly suggested: boolean
  readonly score: number
}

/** Basename (with or without .exe) patterns treated as non-game launchers. */
const BLACKLIST_EXACT = new Set([
  'dxsetup',
  'dxwebsetup',
  'oalinst',
  'redist',
  'dotnet',
  'unitycrashhandler64',
  'unitycrashhandler32',
  'crashreportclient',
  'crashpad_handler',
  'beservice',
  'beservice_x64'
])

const BLACKLIST_PREFIXES = [
  'vcredist',
  'vc_redist',
  'directx',
  'unitycrashhandler',
  'crashreport',
  'easyanticheat',
  'eac_launcher',
  'battleye',
  'beservice',
  'physx',
  'unins',
  'install',
  'setup',
  'dotnet'
]

const BLACKLIST_PATH_SEGMENTS = ['_commonredist', 'commonredist', 'easyanticheat', 'battleye']

/**
 * Strips extension and lowercases a basename.
 *
 * @param value - File name or path segment
 */
const basenameStem = (value: string): string => {
  const base = value.replace(/^.*[/\\]/, '').toLowerCase()
  return base.replace(/\.exe$/i, '')
}

/**
 * True when the executable should not be auto-suggested as Play target.
 *
 * @param nameOrPath - Basename or absolute/relative path
 */
export const isBlacklistedLaunchExe = (nameOrPath: string): boolean => {
  const trimmed = nameOrPath.trim()
  if (!trimmed) return false

  const normalizedPath = trimmed.replace(/\//g, '\\').toLowerCase()
  for (const segment of BLACKLIST_PATH_SEGMENTS) {
    if (normalizedPath.includes(`\\${segment}\\`) || normalizedPath.includes(`\\${segment}`)) {
      return true
    }
  }

  const stem = basenameStem(trimmed)
  if (BLACKLIST_EXACT.has(stem)) return true
  return BLACKLIST_PREFIXES.some((prefix) => stem === prefix || stem.startsWith(prefix))
}

/**
 * Tokenizes a game or file name for overlap scoring.
 *
 * @param value - Raw name
 */
const nameTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)

/**
 * Scores how well an executable matches the game title (higher is better).
 *
 * @param fileName - Executable basename
 * @param gameName - Steam / library game name
 * @param relativePath - Path relative to game root
 */
export const scoreExecutableAgainstGame = (
  fileName: string,
  gameName: string,
  relativePath: string
): number => {
  if (isBlacklistedLaunchExe(fileName) || isBlacklistedLaunchExe(relativePath)) {
    return -1
  }

  const stem = basenameStem(fileName)
  const gameTokens = nameTokens(gameName)
  const fileTokens = nameTokens(stem)
  const pathTokens = nameTokens(relativePath.replace(/[/\\]/g, ' '))

  if (gameTokens.length === 0) {
    const depthPenalty = (relativePath.match(/[/\\]/g) ?? []).length
    return Math.max(0, 10 - depthPenalty)
  }

  let score = 0
  const gameCompact = gameTokens.join('')
  const stemCompact = stem.replace(/[^a-z0-9]/gi, '').toLowerCase()

  if (stemCompact === gameCompact) score += 100
  else if (stemCompact.includes(gameCompact) || gameCompact.includes(stemCompact)) score += 60

  for (const token of gameTokens) {
    if (fileTokens.includes(token) || stemCompact.includes(token)) score += 20
    else if (pathTokens.includes(token)) score += 5
  }

  // Prefer shallower paths for ties.
  const depth = (relativePath.match(/[/\\]/g) ?? []).length
  score -= depth

  // Shipping / client-ish names get a small bump when not blacklisted.
  if (/(shipping|client|game)$/i.test(stem)) score += 8

  return Math.max(0, score)
}

/**
 * Ranks executables: suggested (non-blacklist, score desc) then other (blacklist / zero).
 *
 * @param executables - Flat list from a folder walk
 * @param gameName - Library game title used for scoring
 */
export const rankGameExecutables = (
  executables: readonly RankableExecutable[],
  gameName: string
): RankedExecutable[] => {
  const scored = executables.map((exe) => {
    const blacklisted =
      isBlacklistedLaunchExe(exe.name) || isBlacklistedLaunchExe(exe.relativePath)
    const score = blacklisted
      ? -1
      : scoreExecutableAgainstGame(exe.name, gameName, exe.relativePath)
    const suggested = !blacklisted && score > 0
    return { ...exe, score: blacklisted ? -1 : score, suggested }
  })

  const suggested = scored
    .filter((e) => e.suggested)
    .sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' }))

  const other = scored
    .filter((e) => !e.suggested)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' }))

  return [...suggested, ...other]
}

/**
 * Splits a launch-args string into argv tokens (whitespace + double-quoted groups).
 *
 * @param raw - Stored `launch_args` text
 */
export const tokenizeLaunchArgs = (raw: string): string[] => {
  const input = raw.trim()
  if (!input) return []

  const tokens: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }

  if (current) tokens.push(current)
  return tokens
}
