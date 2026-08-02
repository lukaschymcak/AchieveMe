import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { SteamlessRunResult } from '../../shared/types'

export type { SteamlessRunResult }

/**
 * Absolute path to Steamless.CLI.exe inside a linked folder.
 *
 * @param folder - Steamless install directory.
 */
export function resolveSteamlessCliPath(folder: string): string {
  return path.join(path.resolve(folder), 'Steamless.CLI.exe')
}

/**
 * Validates a Steamless install folder (CLI + Plugins present).
 *
 * @param folder - Absolute or relative folder path.
 * @returns Resolved absolute folder path.
 * @throws If the folder or required files are missing.
 */
export function validateSteamlessFolder(folder: string): string {
  const resolved = path.resolve(folder.trim())
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error('Steamless folder was not found.')
  }

  const cli = resolveSteamlessCliPath(resolved)
  if (!fs.existsSync(cli) || !fs.statSync(cli).isFile()) {
    throw new Error('Steamless.CLI.exe was not found in that folder.')
  }

  const plugins = path.join(resolved, 'Plugins')
  if (!fs.existsSync(plugins) || !fs.statSync(plugins).isDirectory()) {
    throw new Error('Steamless Plugins folder was not found. Extract the full Steamless release.')
  }

  return resolved
}

/**
 * Expected unpacked output path for a Steamless run (`file.exe.unpacked.exe`).
 *
 * @param exePath - Input executable path.
 */
export function expectedUnpackedPath(exePath: string): string {
  return `${path.resolve(exePath)}.unpacked.exe`
}

/**
 * Runs Steamless.CLI.exe on a target executable.
 *
 * @param steamlessFolder - Validated Steamless install directory.
 * @param exePath - Absolute path to the .exe to unpack.
 * @param onLog - Optional line callback for streaming output.
 */
export function runSteamlessUnpack(
  steamlessFolder: string,
  exePath: string,
  onLog?: (line: string) => void
): Promise<SteamlessRunResult> {
  const folder = validateSteamlessFolder(steamlessFolder)
  const cli = resolveSteamlessCliPath(folder)
  const target = path.resolve(exePath)

  if (!target.toLowerCase().endsWith('.exe')) {
    return Promise.reject(new Error('Select a .exe file to unpack.'))
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return Promise.reject(new Error(`Executable was not found: ${target}`))
  }

  const args = ['--recalcchecksum', target]
  const lines: string[] = []

  const append = (chunk: Buffer | string): void => {
    const text = chunk.toString()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue
      lines.push(line)
      onLog?.(line)
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      cwd: folder,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout?.on('data', append)
    child.stderr?.on('data', append)

    child.on('error', (err) => {
      reject(err)
    })

    child.on('close', (code) => {
      const exitCode = code ?? 1
      const expected = expectedUnpackedPath(target)
      const unpackedPath =
        fs.existsSync(expected) && fs.statSync(expected).isFile() ? expected : null
      resolve({
        ok: exitCode === 0,
        exitCode,
        log: lines.join('\n'),
        unpackedPath
      })
    })
  })
}
