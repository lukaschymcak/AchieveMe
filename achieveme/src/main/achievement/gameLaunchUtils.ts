import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { GameExecutable } from '../../shared/types'

/** Error code thrown when Play cannot launch until the user picks an exe. */
export const LAUNCH_NEEDS_EXE = 'LAUNCH_NEEDS_EXE' as const

/**
 * Lists top-level `.exe` files under an install folder (non-recursive).
 *
 * @param installPath - Absolute game install directory.
 * @returns Executable entries with display name and paths.
 */
export function listInstallExecutables(installPath: string): GameExecutable[] {
  const resolved = path.resolve(installPath)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return []
  }

  const results: GameExecutable[] = []
  try {
    for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.toLowerCase().endsWith('.exe')) continue
      results.push({
        name: entry.name,
        relativePath: entry.name,
        absolutePath: path.join(resolved, entry.name)
      })
    }
  } catch {
    return []
  }

  results.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return results
}

/**
 * Returns lowercase process base names (no `.exe`) for playtime matching.
 *
 * @param installPath - Absolute game install directory.
 */
export function listExeBaseNamesForPlaytime(installPath: string): string[] {
  return listInstallExecutables(installPath).map((exe) =>
    path.parse(exe.name).name.toLowerCase()
  )
}

/**
 * Spawns a game executable detached from the AchieveMe process.
 *
 * @param absolutePath - Absolute path to a `.exe` file.
 * @throws If the file is missing or is not an `.exe`.
 */
export function launchGameExe(absolutePath: string): void {
  const resolved = path.resolve(absolutePath)
  const lower = resolved.toLowerCase()
  if (!lower.endsWith('.exe')) {
    throw new Error('Launch path must be a .exe file.')
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Executable was not found: ${resolved}`)
  }

  const child = spawn(resolved, [], {
    cwd: path.dirname(resolved),
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  })
  child.unref()
}
