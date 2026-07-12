import fs from 'node:fs'
import path from 'node:path'

export interface CollectedFile {
  relativePath: string
  absolutePath: string
}

export function getAppFolderPath(achievementFilePath: string): string {
  return path.dirname(achievementFilePath)
}

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
