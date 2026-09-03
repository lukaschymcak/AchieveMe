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
import {
  buildCloudDownloadArgv,
  buildCloudSetArgv,
  buildCloudUploadArgv,
  ludusaviCloudSoftNoteFromApi,
  parseCloudRemoteLabelFromConfigYaml,
  withLudusaviConfig,
  type LudusaviCloudProviderId
} from '../../shared/ludusaviCloudUtils.ts'
import { ludusaviConfigYamlPath } from './ludusaviConfigPatch.ts'

export type { LudusaviSnapshot }

export { withLudusaviConfig }

/** AchieveMe isolated Ludusavi `--config` directory (empty until app ready). */
let isolatedConfigDir = ''

/**
 * Sets the AchieveMe-owned Ludusavi config directory used for all CLI runs.
 *
 * @param dir - Absolute path under Electron userData.
 */
export function setAchieveMeLudusaviConfigDir(dir: string): void {
  isolatedConfigDir = String(dir || '').trim()
}

/**
 * Returns the active isolated Ludusavi config directory.
 */
export function getActiveLudusaviConfigDir(): string {
  return isolatedConfigDir
}

function resolveLudusaviRunner(
  exe: string,
  runCommand?: LudusaviCommandRunner
): LudusaviCommandRunner {
  const base = runCommand ?? createDefaultLudusaviRunner(exe)
  return wrapLudusaviRunnerWithConfig(base, isolatedConfigDir)
}

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
 * Resolves a linked rclone path to an absolute `rclone.exe` file path.
 * Accepts either the exe itself or a directory that contains it.
 *
 * @param rclonePath - User-linked path from settings.
 * @returns Absolute path to rclone.exe.
 * @throws If the path is missing or does not point at rclone.exe.
 */
export function validateRclonePath(rclonePath: string): string {
  const trimmed = String(rclonePath || '').trim()
  if (!trimmed) {
    throw new Error('rclone path is empty.')
  }

  const resolved = path.resolve(trimmed)
  if (!fs.existsSync(resolved)) {
    throw new Error('rclone path was not found.')
  }

  const stat = fs.statSync(resolved)
  if (stat.isDirectory()) {
    const exe = path.join(resolved, 'rclone.exe')
    if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) {
      throw new Error('rclone.exe was not found in that folder.')
    }
    return exe
  }

  if (!stat.isFile()) {
    throw new Error('rclone path must be a file or folder.')
  }

  if (path.basename(resolved).toLowerCase() !== 'rclone.exe') {
    throw new Error('Select rclone.exe (or a folder that contains it).')
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
 * Wraps a Ludusavi runner so every argv is prefixed with `--config <dir>`.
 *
 * @param runCommand - Base runner.
 * @param configDir - AchieveMe isolated Ludusavi config directory.
 */
export function wrapLudusaviRunnerWithConfig(
  runCommand: LudusaviCommandRunner,
  configDir: string
): LudusaviCommandRunner {
  const dir = String(configDir || '').trim()
  if (!dir) return runCommand
  return (argv) => runCommand(withLudusaviConfig(dir, argv))
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
  runCommand?: LudusaviCommandRunner
): Promise<string | null> {
  const cleanAppid = String(appid || '').trim()
  if (!/^\d+$/.test(cleanAppid)) return null

  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(['find', '--steam-id', cleanAppid, '--api'])
  const parsed = parseLudusaviApiJson(result.stdout)
  return extractFindTitle(parsed)
}

/**
 * Runs `ludusavi backup --force --api` with optional cloud sync and `--full-limit 5`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param runCommandOrOptions - Injectable runner, or options bag.
 * @param maybeOptions - Options when the third arg is a runner.
 */
export async function backupGame(
  exe: string,
  title: string,
  runCommandOrOptions?: LudusaviCommandRunner | { cloudSync?: boolean },
  maybeOptions?: { cloudSync?: boolean }
): Promise<LudusaviBackupResult> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }

  let runCommand: LudusaviCommandRunner | undefined
  let cloudSync = false
  if (typeof runCommandOrOptions === 'function') {
    runCommand = runCommandOrOptions
    cloudSync = Boolean(maybeOptions?.cloudSync)
  } else if (runCommandOrOptions && typeof runCommandOrOptions === 'object') {
    cloudSync = Boolean(runCommandOrOptions.cloudSync)
  }

  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner([
    'backup',
    '--force',
    '--api',
    cloudSync ? '--cloud-sync' : '--no-cloud-sync',
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

  const base = extractBackupGameResult(parsed, cleanTitle)
  const soft = ludusaviCloudSoftNoteFromApi(parsed)
  if (soft && base.ok) {
    return { ...base, error: soft }
  }
  if (soft && !base.ok && !base.error) {
    return { ...base, error: soft }
  }
  return base
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
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviSnapshot[]> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) return []

  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(['backups', '--api', cleanTitle])
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
  let runCommand: LudusaviCommandRunner | undefined
  if (typeof backupIdOrRunner === 'function') {
    runCommand = backupIdOrRunner
  } else {
    backupId = backupIdOrRunner
    runCommand = maybeRunner
  }

  const runner = resolveLudusaviRunner(exe, runCommand)
  const argv = ['restore', '--force', '--api', '--no-cloud-sync']
  if (backupId !== undefined && String(backupId).trim() !== '') {
    const id = String(backupId).trim()
    if (!isSafeLudusaviBackupId(id)) {
      return { ok: false, error: 'Invalid backup id.' }
    }
    argv.push('--backup', id)
  }
  argv.push(cleanTitle)

  const result = await runner(argv)

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

export interface LudusaviCloudOpResult {
  ok: boolean
  error?: string
  softNote?: string
}

/**
 * Bootstraps the isolated Ludusavi config directory via `config show`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function ensureLudusaviConfigDir(
  exe: string,
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviCloudOpResult> {
  if (!isolatedConfigDir) {
    return { ok: false, error: 'Ludusavi config directory is not configured.' }
  }
  fs.mkdirSync(isolatedConfigDir, { recursive: true })
  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(['config', 'show'])
  if (result.code !== 0 && !fs.existsSync(ludusaviConfigYamlPath(isolatedConfigDir))) {
    return {
      ok: false,
      error: result.stderr.trim() || `Ludusavi exited with code ${result.code}.`
    }
  }
  return { ok: true }
}

/**
 * Runs `ludusavi cloud set <provider>` under the isolated config.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param provider - Provider id from Settings.
 * @param customRemoteId - Required for `custom`.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function cloudSetProvider(
  exe: string,
  provider: LudusaviCloudProviderId,
  customRemoteId?: string,
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviCloudOpResult> {
  let argv: string[]
  try {
    argv = buildCloudSetArgv(provider, customRemoteId)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(argv)
  if (result.code !== 0) {
    return {
      ok: false,
      error: result.stderr.trim() || result.stdout.trim() || `Ludusavi exited with code ${result.code}.`
    }
  }
  return { ok: true }
}

/**
 * Runs `ludusavi cloud upload --force --api`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function cloudUpload(
  exe: string,
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviCloudOpResult> {
  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(buildCloudUploadArgv())
  const parsed = parseLudusaviApiJson(result.stdout)
  const soft = parsed ? ludusaviCloudSoftNoteFromApi(parsed) : ''
  if (result.code !== 0) {
    return {
      ok: false,
      error:
        soft ||
        result.stderr.trim() ||
        result.stdout.trim() ||
        `Ludusavi exited with code ${result.code}.`,
      softNote: soft || undefined
    }
  }
  if (soft) {
    return { ok: false, error: soft, softNote: soft }
  }
  return { ok: true }
}

/**
 * Runs `ludusavi cloud download --force --api`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param runCommand - Optional injectable runner (tests).
 */
export async function cloudDownload(
  exe: string,
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviCloudOpResult> {
  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(buildCloudDownloadArgv())
  const parsed = parseLudusaviApiJson(result.stdout)
  const soft = parsed ? ludusaviCloudSoftNoteFromApi(parsed) : ''
  if (result.code !== 0) {
    return {
      ok: false,
      error:
        soft ||
        result.stderr.trim() ||
        result.stdout.trim() ||
        `Ludusavi exited with code ${result.code}.`,
      softNote: soft || undefined
    }
  }
  if (soft) {
    return { ok: false, error: soft, softNote: soft }
  }
  return { ok: true }
}

export interface LudusaviCloudStatus {
  connected: boolean
  label: string | null
  configDir: string
}

/**
 * Reads cloud remote status from the AchieveMe-owned config.yaml.
 */
export function readLudusaviCloudStatus(): LudusaviCloudStatus {
  const configDir = isolatedConfigDir
  if (!configDir) {
    return { connected: false, label: null, configDir: '' }
  }
  const file = ludusaviConfigYamlPath(configDir)
  if (!fs.existsSync(file)) {
    return { connected: false, label: null, configDir }
  }
  try {
    const text = fs.readFileSync(file, 'utf8')
    const label = parseCloudRemoteLabelFromConfigYaml(text)
    return { connected: Boolean(label), label, configDir }
  } catch {
    return { connected: false, label: null, configDir }
  }
}
