import fs from 'node:fs'
import path from 'node:path'

export interface CollectedFile {
  relativePath: string
  absolutePath: string
}

export interface WalkDirsBoundedOptions {
  /** Max depth from root (root = 0). Default 4. */
  maxDepth?: number
  /** Max directories visited per root. Default 5000. */
  maxDirs?: number
  /** Return true to skip descending into this directory basename. */
  shouldSkip?: (dirName: string) => boolean
}

/**
 * Returns the parent directory of an achievement save file path.
 *
 * @param achievementFilePath - Absolute path to achievements.json / .ini
 */
export function getAppFolderPath(achievementFilePath: string): string {
  return path.dirname(achievementFilePath)
}

/**
 * Recursively lists files under `dir` (unlimited depth). Legacy helper.
 *
 * @param dir - Absolute directory to walk
 */
export function collectFilesRecursive(dir: string): CollectedFile[] {
  const results: CollectedFile[] = []

  function walk(current: string, prefix: string): void {
    let entries: string[]
    try {
      entries = fs.readdirSync(current)
    } catch {
      return
    }

    for (const name of entries) {
      const absolutePath = path.join(current, name)
      const relativePath = prefix ? `${prefix}/${name}` : name

      let stat: fs.Stats
      try {
        stat = fs.statSync(absolutePath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(absolutePath, relativePath)
      } else if (stat.isFile()) {
        results.push({ relativePath, absolutePath })
      }
    }
  }

  walk(dir, '')
  return results
}

/**
 * Breadth-first directory listing with depth and visit caps for install scans.
 * Includes the root itself as the first entry when it exists.
 *
 * @param root - Absolute root directory
 * @param options - Depth, visit cap, skip predicate
 * @returns Absolute directory paths visited
 */
export function walkDirsBounded(
  root: string,
  options: WalkDirsBoundedOptions = {}
): string[] {
  const maxDepth = options.maxDepth ?? 4
  const maxDirs = options.maxDirs ?? 5000
  const shouldSkip = options.shouldSkip ?? (() => false)

  const resolved = path.resolve(root)
  if (!fs.existsSync(resolved)) return []
  let rootStat: fs.Stats
  try {
    rootStat = fs.statSync(resolved)
  } catch {
    return []
  }
  if (!rootStat.isDirectory()) return []

  const out: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: resolved, depth: 0 }]
  let visited = 0

  while (queue.length > 0 && visited < maxDirs) {
    const { dir, depth } = queue.shift()!
    visited++
    out.push(dir)

    if (depth >= maxDepth) continue

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (shouldSkip(entry.name)) continue
      if (visited + queue.length >= maxDirs) break
      queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 })
    }
  }

  return out
}
