import path from 'node:path'
import type { AppSettings, SourceId } from '../../shared/types'

export const GOLDBERG_JSON_SOURCES: SourceId[] = ['goldberg', 'gse']

export function expandEnv(value: string): string {
  return value.replace(/%([^%]+)%/g, (_, key: string) => process.env[key] ?? '')
}

/** Default save folder root paths per emulator (Windows env vars expanded at runtime). */
export const DEFAULT_ROOTS: Record<SourceId, string[]> = {
  goldberg: [expandEnv('%APPDATA%\\Goldberg SteamEmu Saves')],
  gse: [expandEnv('%APPDATA%\\GSE Saves')],
  codex: [expandEnv('%PUBLIC%\\Documents\\Steam\\CODEX')],
  rune: [expandEnv('%PUBLIC%\\Documents\\Steam\\RUNE')]
}

export const SOURCE_FILE: Record<SourceId, string> = {
  goldberg: 'achievements.json',
  gse: 'achievements.json',
  codex: 'achievements.ini',
  rune: 'achievements.ini'
}

export function getDefaultRootsForSource(source: SourceId): string[] {
  return DEFAULT_ROOTS[source] ?? []
}

export function getRootsForSource(source: SourceId, settings: AppSettings): string[] {
  return [...getDefaultRootsForSource(source), ...settings.customWatchFolders]
}

/** Relative path from emulator root to the save file. */
export function getRelativeSavePath(source: SourceId, appid: string): string {
  return path.join(appid, SOURCE_FILE[source])
}

export interface PortablePathHint {
  rootKind: 'default' | 'custom'
  rootSource: SourceId
  customRoot: string
  relativePath: string
}

function normalizeForCompare(p: string): string {
  return path.resolve(p).toLowerCase()
}

function findMatchingRoot(
  filePath: string,
  source: SourceId,
  settings: AppSettings
): { root: string; isDefault: boolean } | null {
  const abs = path.resolve(filePath)
  const candidates: Array<{ root: string; isDefault: boolean }> = []

  for (const root of getDefaultRootsForSource(source)) {
    if (root) candidates.push({ root: path.resolve(root), isDefault: true })
  }
  for (const root of settings.customWatchFolders) {
    if (root.trim()) candidates.push({ root: path.resolve(root.trim()), isDefault: false })
  }

  candidates.sort((a, b) => b.root.length - a.root.length)

  const absNorm = normalizeForCompare(abs)
  for (const { root, isDefault } of candidates) {
    const rootNorm = normalizeForCompare(root)
    if (absNorm === rootNorm || absNorm.startsWith(rootNorm + path.sep.toLowerCase())) {
      return { root, isDefault }
    }
  }
  return null
}

export function encodePortablePath(
  filePath: string,
  source: SourceId,
  settings: AppSettings
): PortablePathHint {
  const match = findMatchingRoot(filePath, source, settings)
  const relativePath = match
    ? path.relative(match.root, filePath)
    : getRelativeSavePath(source, path.basename(path.dirname(filePath)))

  if (match?.isDefault) {
    return {
      rootKind: 'default',
      rootSource: source,
      customRoot: '',
      relativePath: relativePath.replace(/\\/g, '/')
    }
  }

  if (match) {
    return {
      rootKind: 'custom',
      rootSource: source,
      customRoot: match.root,
      relativePath: relativePath.replace(/\\/g, '/')
    }
  }

  return {
    rootKind: 'custom',
    rootSource: source,
    customRoot: path.dirname(filePath),
    relativePath: path.basename(filePath)
  }
}

export interface ResolvePortableOptions {
  customRootOverride?: string
}

export function resolvePortablePath(
  hint: PortablePathHint,
  settings: AppSettings,
  options: ResolvePortableOptions = {}
): string {
  const rel = hint.relativePath.replace(/\//g, path.sep)

  if (hint.rootKind === 'default') {
    const defaults = getDefaultRootsForSource(hint.rootSource)
    const root = defaults[0]
    if (!root) {
      throw new Error(`No default root for source ${hint.rootSource}`)
    }
    return path.join(root, rel)
  }

  const customRoot = options.customRootOverride ?? hint.customRoot
  if (!customRoot) {
    throw new Error('Custom root path is missing')
  }
  return path.join(customRoot, rel)
}
