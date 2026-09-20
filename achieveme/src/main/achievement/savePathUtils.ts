import fs from 'node:fs'
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

/**
 * Returns existing Goldberg/GSE save folder directories for an appid.
 * Checks default roots (%APPDATA%\GSE Saves, %APPDATA%\Goldberg SteamEmu Saves)
 * and settings.customWatchFolders.
 */
export function getGseSaveFoldersForAppid(appid: string, settings: AppSettings): string[] {
  const cleanAppid = String(appid || '').trim()
  if (!cleanAppid) return []

  const candidateDirs: string[] = []
  for (const source of GOLDBERG_JSON_SOURCES) {
    for (const root of getDefaultRootsForSource(source)) {
      if (root) {
        candidateDirs.push(path.join(root, cleanAppid))
      }
    }
  }
  for (const customRoot of settings.customWatchFolders || []) {
    if (customRoot && customRoot.trim()) {
      candidateDirs.push(path.join(customRoot.trim(), cleanAppid))
    }
  }

  const existingFolders: string[] = []
  const seen = new Set<string>()

  for (const dir of candidateDirs) {
    const resolved = path.resolve(dir)
    const key = resolved.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        existingFolders.push(resolved)
      }
    } catch {
      // Ignore filesystem access errors
    }
  }

  return existingFolders
}

