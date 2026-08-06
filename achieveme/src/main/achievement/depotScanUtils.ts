import fs from 'node:fs'
import path from 'node:path'
import type { SteamApiDllInfo } from '../../shared/types'

/**
 * Recursively finds steam_api.dll / steam_api64.dll under a download folder.
 *
 * @param rootDir - Folder to scan (typically DepotDownloader output)
 */
export function scanSteamApiDll(rootDir: string): SteamApiDllInfo | null {
  const resolved = path.resolve(rootDir)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return null

  const queue = [resolved]
  let visited = 0
  while (queue.length > 0 && visited < 5000) {
    const dir = queue.shift()!
    visited++
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase()
        if (lower === 'node_modules' || lower === '.git') continue
        queue.push(full)
        continue
      }
      if (!entry.isFile()) continue
      const lower = entry.name.toLowerCase()
      if (lower === 'steam_api64.dll') {
        return {
          path: full,
          fileName: entry.name,
          directory: dir,
          architecture: 'x64'
        }
      }
      if (lower === 'steam_api.dll') {
        return {
          path: full,
          fileName: entry.name,
          directory: dir,
          architecture: 'x86'
        }
      }
    }
  }
  return null
}
