import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  extractBackupGameResult,
  extractBackupSnapshots,
  extractFindTitle,
  isSafeLudusaviBackupId,
  parseLudusaviApiJson,
  takeNewestSnapshots,
  type LudusaviSnapshot
} from '../../shared/ludusaviApiUtils.ts'

export type { LudusaviSnapshot }

export interface LudusaviCommandResult {
  code: number
  stdout: string
  stderr: string
}

export type LudusaviCommandRunner = (argv: string[]) => Promise<LudusaviCommandResult>

export interface LudusaviBackupResult {
  ok: boolean
  decision?: string
  /** Game-level ScanChange from Ludusavi (`New` / `Different` / `Same` / …). */
  change?: string
  bytes?: number
  error?: string
}

/** Full backups retained per game for AchieveMe-initiated backups. */
export const LUDUSAVI_FULL_BACKUP_LIMIT = 5

/**
 * Resolves a linked Ludusavi path to an absolute `ludusavi.exe` file path.
 * Accepts either the exe itself or a directory that contains it.
 *
 * @param ludusaviPath - User-linked path from settings.
 * @returns Absolute path to ludusavi.exe.
 * @throws If the path is missing or does not point at ludusavi.exe.
 */
export function validateLudusaviPath(ludusaviPath: string): string {
  const trimmed = String(ludusaviPath || '').trim()
  if (!trimmed) {
    throw new Error('Ludusavi path is empty.')
  }

  const resolved = path.resolve(trimmed)
  if (!fs.existsSync(resolved)) {
    throw new Error('Ludusavi path was not found.')
  }

  const stat = fs.statSync(resolved)
  if (stat.isDirectory()) {
    const exe = path.join(resolved, 'ludusavi.exe')
    if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) {
      throw new Error('ludusavi.exe was not found in that folder.')
    }
    return exe
  }

  if (!stat.isFile()) {
    throw new Error('Ludusavi path must be a file or folder.')
  }

  if (path.basename(resolved).toLowerCase() !== 'ludusavi.exe') {
    throw new Error('Select ludusavi.exe (or a folder that contains it).')
  }

  return resolved
}

/**
 * Default spawn-based command runner for Ludusavi CLI.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param argv - Arguments after the executable (subcommand + flags).
 */
export function createDefaultLudusaviRunner(exe: string): LudusaviCommandRunner {
  return (argv) =>
    new Promise((resolve, reject) => {
      const child = spawn(exe, argv, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString()
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        resolve({ code: code ?? 1, stdout, stderr })
      })
    })
}

/**
 * Resolves a Ludusavi game title via `find --steam-id`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param appid - Steam AppID.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function findTitleBySteamId(
  exe: string,
  appid: string,
  runCommand: LudusaviCommandRunner = createDefaultLudusaviRunner(exe)
): Promise<string | null> {
  const cleanAppid = String(appid || '').trim()
  if (!/^\d+$/.test(cleanAppid)) return null

  const result = await runCommand(['find', '--steam-id', cleanAppid, '--api'])
  const parsed = parseLudusaviApiJson(result.stdout)
  return extractFindTitle(parsed)
}

/**
 * Runs `ludusavi backup --force --api --no-cloud-sync --full-limit 5` for one title.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function backupGame(
  exe: string,
  title: string,
  runCommand: LudusaviCommandRunner = createDefaultLudusaviRunner(exe)
): Promise<LudusaviBackupResult> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }

  const result = await runCommand([
    'backup',
    '--force',
    '--api',
    '--no-cloud-sync',
    '--full-limit',
    String(LUDUSAVI_FULL_BACKUP_LIMIT),
    cleanTitle
  ])

  const parsed = parseLudusaviApiJson(result.stdout)
  if (!parsed) {
    const stderr = result.stderr.trim()
    return {
      ok: false,
      error:
        stderr ||
        (result.code !== 0
          ? `Ludusavi exited with code ${result.code}.`
          : 'Ludusavi returned no API JSON.')
    }
  }

  return extractBackupGameResult(parsed, cleanTitle)
}

/**
 * Lists up to five newest Ludusavi snapshots for a title.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function listGameBackups(
  exe: string,
  title: string,
  runCommand: LudusaviCommandRunner = createDefaultLudusaviRunner(exe)
): Promise<LudusaviSnapshot[]> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) return []

  const result = await runCommand(['backups', '--api', cleanTitle])
  const parsed = parseLudusaviApiJson(result.stdout)
  if (!parsed) return []
  return takeNewestSnapshots(
    extractBackupSnapshots(parsed, cleanTitle),
    LUDUSAVI_FULL_BACKUP_LIMIT
  )
}

/**
 * Runs `ludusavi restore --force --api --no-cloud-sync` for one title.
 * When `backupId` is set, adds `--backup <id>` (required for picker restores).
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param backupIdOrRunner - Snapshot id, or injectable runner (legacy tests).
 * @param maybeRunner - Injectable runner when backupId is a string.
 */
export async function restoreGame(
  exe: string,
  title: string,
  backupIdOrRunner?: string | LudusaviCommandRunner,
  maybeRunner?: LudusaviCommandRunner
): Promise<LudusaviBackupResult> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }

  let backupId: string | undefined
  let runCommand: LudusaviCommandRunner
  if (typeof backupIdOrRunner === 'function') {
    runCommand = backupIdOrRunner
  } else {
    backupId = backupIdOrRunner
    runCommand = maybeRunner ?? createDefaultLudusaviRunner(exe)
  }

  const argv = ['restore', '--force', '--api', '--no-cloud-sync']
  if (backupId !== undefined && String(backupId).trim() !== '') {
    const id = String(backupId).trim()
    if (!isSafeLudusaviBackupId(id)) {
      return { ok: false, error: 'Invalid backup id.' }
    }
    argv.push('--backup', id)
  }
  argv.push(cleanTitle)

  const result = await runCommand(argv)

  const parsed = parseLudusaviApiJson(result.stdout)
  if (!parsed) {
    const stderr = result.stderr.trim()
    return {
      ok: false,
      error:
        stderr ||
        (result.code !== 0
          ? `Ludusavi exited with code ${result.code}.`
          : 'Ludusavi returned no API JSON.')
    }
  }

  return extractBackupGameResult(parsed, cleanTitle)
}
