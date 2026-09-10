import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  extractBackupGameResult,
  extractBackupSnapshots,
  extractFindTitle,
  extractGameBackupPath,
  isSafeLudusaviBackupId,
  parseLudusaviApiJson,
  sortSnapshotsNewestFirst,
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
import {
  ludusaviConfigYamlPath,
  syncIsolatedLudusaviConfigFromGui,
  writeCloudSynchronizeToLudusaviConfig,
  writeRclonePathToLudusaviConfig
} from './ludusaviConfigPatch.ts'
import {
  filterExistingLudusaviSnapshots,
  findMappingYamlInSnapshotDir,
  isCloudSnapshotBackupId,
  listCloudSnapshotFolders,
  mergeGameRootMetadataIntoDir,
  resolveLudusaviGameBackupDir,
  resolveLudusaviSnapshotDir,
  sanitizeLudusaviBackupTitle,
  writeNormalizedLudusaviMappingYaml
} from './ludusaviBackupArchive.ts'
import {
  cloudSavesError,
  cloudSavesLog,
  cloudSavesWarn,
  listDirNamesForLog,
  truncateCloudLogText
} from './cloudSavesDebugLog.ts'

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

/**
 * Re-reads Ludusavi GUI config into the AchieveMe isolated dir (backup.path, roots,
 * customGames, etc.) so CLI / archive paths match ludusavi.exe after the user changes settings.
 *
 * @param rcloneExe - Optional rclone path to keep after sync.
 */
export function refreshAchieveMeLudusaviConfigFromGui(rcloneExe?: string): {
  ok: boolean
  syncedFromGui: boolean
} {
  if (!isolatedConfigDir) {
    return { ok: false, syncedFromGui: false }
  }
  return syncIsolatedLudusaviConfigFromGui(isolatedConfigDir, { rcloneExe })
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
 * Runs `ludusavi backup --force --api --no-cloud-sync --full-limit 5 <title>`.
 * Cloud upload is handled separately by AchieveMe after a successful local backup.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param runCommand - Injectable runner (tests).
 */
export async function backupGame(
  exe: string,
  title: string,
  runCommand?: LudusaviCommandRunner
): Promise<LudusaviBackupResult> {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }

  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner([
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
 * Lists up to five newest Ludusavi snapshots for a title, plus any AchieveMe
 * cloud download folders on disk (labeled `source: 'cloud'`).
 * Re-reads `backups --api` then drops rows whose snapshot dirs are gone on disk.
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
  const fromApi = parsed ? extractBackupSnapshots(parsed, cleanTitle) : []
  const configDir = getActiveLudusaviConfigDir()
  if (!configDir) {
    return takeNewestSnapshots(fromApi, LUDUSAVI_FULL_BACKUP_LIMIT)
  }
  try {
    const gameDir = resolveLudusaviGameBackupDir(configDir, cleanTitle, {
      apiBackupPath: parsed ? extractGameBackupPath(parsed, cleanTitle) : null
    })
    const localExisting = filterExistingLudusaviSnapshots(gameDir, fromApi).filter(
      (snap) => !isCloudSnapshotBackupId(snap.id)
    )
    const local = takeNewestSnapshots(localExisting, LUDUSAVI_FULL_BACKUP_LIMIT).map(
      (snap) => ({ ...snap, source: 'local' as const })
    )
    const cloud = listCloudSnapshotFolders(gameDir).map((snap) => ({
      ...snap,
      source: 'cloud' as const
    }))
    return sortSnapshotsNewestFirst([...local, ...cloud])
  } catch {
    return takeNewestSnapshots(fromApi, LUDUSAVI_FULL_BACKUP_LIMIT)
  }
}

/**
 * Runs `ludusavi restore --force --api --no-cloud-sync` for one title.
 * When `backupId` is a Ludusavi snapshot id, adds `--backup <id>`.
 * When `backupId` is an AchieveMe `cloud-*` folder, stages it and uses `--path`
 * (Ludusavi does not know cloud ids as --backup names).
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param title - Exact Ludusavi game title.
 * @param backupIdOrRunner - Snapshot id, or injectable runner (legacy tests).
 * @param maybeRunner - Injectable runner when backupId is a string.
 * @param options - Required for cloud-* restores (`configDir` + `stagingRoot`).
 */
export async function restoreGame(
  exe: string,
  title: string,
  backupIdOrRunner?: string | LudusaviCommandRunner,
  maybeRunner?: LudusaviCommandRunner,
  options?: { configDir?: string; stagingRoot?: string }
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

  const id = backupId !== undefined ? String(backupId).trim() : ''
  if (id && isCloudSnapshotBackupId(id)) {
    const configDir = String(options?.configDir || '').trim() || getActiveLudusaviConfigDir()
    const stagingRoot = String(options?.stagingRoot || '').trim()
    cloudSavesLog('restore.route', {
      mode: 'cloud-path',
      title: cleanTitle,
      backupId: id,
      hasConfigDir: Boolean(configDir),
      hasStagingRoot: Boolean(stagingRoot)
    })
    if (!configDir || !stagingRoot) {
      cloudSavesError('restore.cloud.missing-dirs', {
        hasConfigDir: Boolean(configDir),
        hasStagingRoot: Boolean(stagingRoot)
      })
      return {
        ok: false,
        error: 'Cloud restore requires config and staging directories.'
      }
    }
    return restoreCloudSnapshotGame({
      exe,
      title: cleanTitle,
      cloudBackupId: id,
      configDir,
      stagingRoot,
      runCommand
    })
  }

  cloudSavesLog('restore.route', {
    mode: id ? 'local-backup' : 'latest',
    title: cleanTitle,
    backupId: id || null
  })

  const runner = resolveLudusaviRunner(exe, runCommand)
  const argv = ['restore', '--force', '--api', '--no-cloud-sync']
  if (id) {
    if (!isSafeLudusaviBackupId(id)) {
      cloudSavesWarn('restore.local.invalid-id', { backupId: id })
      return { ok: false, error: 'Invalid backup id.' }
    }
    argv.push('--backup', id)
  }
  argv.push(cleanTitle)

  const result = await runner(argv)
  cloudSavesLog('restore.local.cli', {
    code: result.code,
    argv,
    stdout: truncateCloudLogText(result.stdout),
    stderr: truncateCloudLogText(result.stderr)
  })

  const parsed = parseLudusaviApiJson(result.stdout)
  if (!parsed) {
    const stderr = result.stderr.trim()
    const error =
      stderr ||
      (result.code !== 0
        ? `Ludusavi exited with code ${result.code}.`
        : 'Ludusavi returned no API JSON.')
    cloudSavesError('restore.local.no-json', { error })
    return { ok: false, error }
  }

  const extracted = extractBackupGameResult(parsed, cleanTitle)
  cloudSavesLog('restore.local.result', {
    ok: extracted.ok,
    decision: extracted.decision,
    error: extracted.error || null
  })
  return extracted
}

/**
 * Stages a downloaded `cloud-*` folder as `{stagingRoot}/{title}/` and restores via `--path`.
 */
export async function restoreCloudSnapshotGame(input: {
  exe: string
  title: string
  cloudBackupId: string
  configDir: string
  stagingRoot: string
  runCommand?: LudusaviCommandRunner
}): Promise<LudusaviBackupResult> {
  const cleanTitle = String(input.title || '').trim()
  if (!cleanTitle) {
    return { ok: false, error: 'Game title is required.' }
  }
  const folderName = sanitizeLudusaviBackupTitle(cleanTitle)
  const cloudId = String(input.cloudBackupId || '').trim()
  if (!isCloudSnapshotBackupId(cloudId)) {
    cloudSavesError('restore.cloud.invalid-id', { cloudBackupId: cloudId })
    return { ok: false, error: 'Invalid cloud backup id.' }
  }

  const gameDir = resolveLudusaviGameBackupDir(input.configDir, cleanTitle)
  let cloudDir: string
  try {
    cloudDir = resolveLudusaviSnapshotDir(gameDir, cloudId)
  } catch (err) {
    cloudSavesError('restore.cloud.path-resolve', {
      gameDir,
      cloudId,
      error: err instanceof Error ? err.message : String(err)
    })
    return { ok: false, error: 'Invalid cloud backup path.' }
  }
  cloudSavesLog('restore.cloud.paths', {
    configDir: input.configDir,
    gameDir,
    cloudDir,
    cloudEntries: listDirNamesForLog(cloudDir),
    gameEntries: listDirNamesForLog(gameDir)
  })
  if (!fs.existsSync(cloudDir) || !fs.statSync(cloudDir).isDirectory()) {
    cloudSavesError('restore.cloud.missing-folder', { cloudDir })
    return { ok: false, error: 'Cloud save folder was not found. Download it again.' }
  }

  const stagingRoot = path.resolve(input.stagingRoot)
  const stagedGame = path.join(stagingRoot, folderName)
  cloudSavesLog('restore.cloud.stage', {
    stagingRoot,
    stagedGame,
    cloudHadMapping: Boolean(findMappingYamlInSnapshotDir(cloudDir))
  })
  await fs.promises.mkdir(stagingRoot, { recursive: true })
  await fs.promises.rm(stagedGame, { recursive: true, force: true })
  await fs.promises.cp(cloudDir, stagedGame, { recursive: true })
  const mergedMeta = await mergeGameRootMetadataIntoDir(gameDir, stagedGame)
  if (mergedMeta.length > 0) {
    cloudSavesLog('restore.cloud.merged-game-root-meta', { mergedMeta })
  }

  const drivesHint =
    findMappingYamlInSnapshotDir(stagedGame) ||
    findMappingYamlInSnapshotDir(gameDir) ||
    null
  let mappingPath: string
  try {
    mappingPath = await writeNormalizedLudusaviMappingYaml(stagedGame, cleanTitle, {
      drivesHintPath: drivesHint
    })
    cloudSavesLog('restore.cloud.normalized-mapping', {
      mappingPath,
      drivesHint: drivesHint || null
    })
  } catch (err) {
    cloudSavesError('restore.cloud.normalize-mapping-failed', {
      cloudDir,
      gameDir,
      stagedEntries: listDirNamesForLog(stagedGame),
      error: err instanceof Error ? err.message : String(err)
    })
    await fs.promises.rm(stagedGame, { recursive: true, force: true }).catch(() => undefined)
    return {
      ok: false,
      error:
        'Cloud save has no restorable drive-* files (or mapping could not be built). Re-upload from AchieveMe, then download again.'
    }
  }
  cloudSavesLog('restore.cloud.staged', {
    mappingPath,
    stagedEntries: listDirNamesForLog(stagedGame),
    stagedHasMapping: true
  })

  try {
    const runner = resolveLudusaviRunner(input.exe, input.runCommand)
    const argv = [
      'restore',
      '--force',
      '--api',
      '--no-cloud-sync',
      '--backup',
      '.',
      '--path',
      stagingRoot,
      cleanTitle
    ]
    cloudSavesLog('restore.cloud.cli.start', { argv })
    const result = await runner(argv)
    cloudSavesLog('restore.cloud.cli.done', {
      code: result.code,
      stdout: truncateCloudLogText(result.stdout),
      stderr: truncateCloudLogText(result.stderr)
    })
    const parsed = parseLudusaviApiJson(result.stdout)
    if (!parsed) {
      const stderr = result.stderr.trim()
      const error =
        stderr ||
        (result.code !== 0
          ? `Ludusavi exited with code ${result.code}.`
          : 'Ludusavi returned no API JSON.')
      cloudSavesError('restore.cloud.no-json', { error })
      return { ok: false, error }
    }
    const extracted = extractBackupGameResult(parsed, cleanTitle)
    if (!extracted.ok) {
      cloudSavesError('restore.cloud.result-failed', {
        decision: extracted.decision || null,
        error: extracted.error || null
      })
    } else {
      cloudSavesLog('restore.cloud.result-ok', {
        decision: extracted.decision,
        bytes: extracted.bytes ?? null
      })
    }
    return extracted
  } finally {
    await fs.promises.rm(stagedGame, { recursive: true, force: true }).catch(() => undefined)
  }
}

export interface LudusaviCloudOpResult {
  ok: boolean
  error?: string
  softNote?: string
}

/**
 * Bootstraps the isolated Ludusavi config directory from the Ludusavi GUI config when
 * present, otherwise via `config show`.
 *
 * @param exe - Absolute path to ludusavi.exe.
 * @param runCommand - Optional injectable runner (tests).
 * @param rcloneExe - Optional rclone path preserved after GUI sync.
 */
export async function ensureLudusaviConfigDir(
  exe: string,
  runCommand?: LudusaviCommandRunner,
  rcloneExe?: string
): Promise<LudusaviCloudOpResult> {
  if (!isolatedConfigDir) {
    return { ok: false, error: 'Ludusavi config directory is not configured.' }
  }
  fs.mkdirSync(isolatedConfigDir, { recursive: true })
  const synced = syncIsolatedLudusaviConfigFromGui(isolatedConfigDir, { rcloneExe })
  if (synced.ok && synced.syncedFromGui) {
    return { ok: true }
  }
  const runner = resolveLudusaviRunner(exe, runCommand)
  const result = await runner(['config', 'show'])
  if (result.code !== 0 && !fs.existsSync(ludusaviConfigYamlPath(isolatedConfigDir))) {
    return {
      ok: false,
      error: result.stderr.trim() || `Ludusavi exited with code ${result.code}.`
    }
  }
  writeCloudSynchronizeToLudusaviConfig(isolatedConfigDir, false)
  if (rcloneExe) {
    writeRclonePathToLudusaviConfig(isolatedConfigDir, rcloneExe)
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
