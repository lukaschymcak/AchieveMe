import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import os from 'node:os'
import { pipeline } from 'node:stream/promises'
import { Readable, Writable, Transform } from 'node:stream'
import {
  isWithinCloudSaveArtifactCap,
  MAX_CLOUD_SAVE_ARTIFACT_BYTES
} from '../../shared/r2CloudSaveUtils.ts'

export type ArchiveResult = {
  archivePath: string
  bytes: number
  sha256: string
}

/** Filename chars Ludusavi replaces with `_` in backup folder names. */
const LUDUSAVI_INVALID_FILE_CHARS = /[\\/:*?"<>|\0]/g

/**
 * Encodes a Ludusavi game title the same way the CLI names backup folders.
 * Invalid Windows filename characters become `_`.
 *
 * @param title - Ludusavi game title.
 */
export function encodeLudusaviBackupFolderName(title: string): string {
  return String(title || '').trim().replace(LUDUSAVI_INVALID_FILE_CHARS, '_')
}

/**
 * Sanitizes a Ludusavi title into a backup-folder component.
 * Encodes invalid filename chars; rejects empty / `.` / `..`.
 */
export function sanitizeLudusaviBackupTitle(title: string): string {
  const encoded = encodeLudusaviBackupFolderName(title)
  if (!encoded) {
    throw new Error('Ludusavi title is required.')
  }
  if (encoded === '.' || encoded === '..') {
    throw new Error('Ludusavi title is unsafe.')
  }
  return encoded
}

function expandLudusaviConfiguredPath(raw: string, fallback: string): string {
  const value = String(raw || '').trim()
  if (!value) return fallback
  if (value === '~') return path.resolve(os.homedir())
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.resolve(os.homedir(), value.slice(2))
  }
  return path.resolve(value)
}

function parseMappingYamlGameName(text: string): string {
  const match = /^name:\s*(.+)\s*$/m.exec(String(text || ''))
  if (!match) return ''
  return String(match[1] || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
}

function isDirInsideRoot(root: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(candidate))
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Scans backup-root children for mapping.yaml with an exact Ludusavi name match.
 *
 * @param backupRoot - Absolute Ludusavi backup.path directory.
 * @param title - Exact Ludusavi game title.
 */
export function findLudusaviGameBackupDirByMappingName(
  backupRoot: string,
  title: string
): string | null {
  const wanted = String(title || '').trim()
  const root = path.resolve(backupRoot)
  if (!wanted) return null
  let names: string[]
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null
    names = fs.readdirSync(root)
  } catch {
    return null
  }
  for (const name of names) {
    const dir = path.resolve(root, name)
    if (!isDirInsideRoot(root, dir)) continue
    let stat: fs.Stats
    try {
      stat = fs.statSync(dir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const mapping = path.join(dir, 'mapping.yaml')
    try {
      if (!fs.existsSync(mapping) || !fs.statSync(mapping).isFile()) continue
      if (parseMappingYamlGameName(fs.readFileSync(mapping, 'utf8')) === wanted) {
        return dir
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Reads `backup.path` from AchieveMe’s Ludusavi `config.yaml`.
 * Falls back to `{configDir}/backup` when missing or unreadable.
 * Expands a leading `~` to the user home directory (Ludusavi default).
 *
 * @param configDir - Ludusavi `--config` directory.
 */
export function readLudusaviBackupPathFromConfig(configDir: string): string {
  const fallback = path.resolve(configDir, 'backup')
  const configPath = path.join(configDir, 'config.yaml')
  try {
    if (!fs.existsSync(configPath)) return fallback
    const text = fs.readFileSync(configPath, 'utf8')
    const backupBlock = /(?:^|\n)backup:\s*\r?\n([\s\S]*?)(?=\n(?:[a-zA-Z][\w]*):|\n*$)/.exec(
      text.startsWith('backup:') ? `\n${text}` : text
    )
    if (!backupBlock) return fallback
    const pathLine = /^[ \t]+path:\s*(.+)\s*$/m.exec(backupBlock[1])
    const raw = String(pathLine?.[1] || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim()
    if (!raw) return fallback
    return expandLudusaviConfiguredPath(raw, fallback)
  } catch {
    return fallback
  }
}

/**
 * Resolves `{backupRoot}/{encodedTitle}` using Ludusavi `backup.path`.
 * Uses Ludusavi’s `_` filename encoding, then mapping.yaml name if the
 * encoded folder is missing (renamed dirs / GUI backups).
 *
 * @param configDir - Ludusavi `--config` directory.
 * @param title - Exact Ludusavi game title.
 * @param options - Optional `backupPath` from `backups --api`.
 */
export function resolveLudusaviGameBackupDir(
  configDir: string,
  title: string,
  options?: { apiBackupPath?: string | null }
): string {
  const originalTitle = String(title || '').trim()
  const safeTitle = sanitizeLudusaviBackupTitle(originalTitle)
  const backupRoot = readLudusaviBackupPathFromConfig(configDir)
  const apiRaw = String(options?.apiBackupPath || '').trim()
  if (apiRaw) {
    const apiDir = path.resolve(apiRaw)
    if (isDirInsideRoot(backupRoot, apiDir)) {
      try {
        if (fs.existsSync(apiDir) && fs.statSync(apiDir).isDirectory()) {
          return apiDir
        }
      } catch {
        // Fall through to encoded / mapping.yaml lookup
      }
    }
  }
  const gameDir = path.resolve(backupRoot, safeTitle)
  if (!isDirInsideRoot(backupRoot, gameDir)) {
    throw new Error('Ludusavi backup path escapes backup root.')
  }
  try {
    if (fs.existsSync(gameDir) && fs.statSync(gameDir).isDirectory()) {
      return gameDir
    }
  } catch {
    // Fall through to mapping.yaml scan
  }
  const mapped = findLudusaviGameBackupDirByMappingName(backupRoot, originalTitle)
  return mapped || gameDir
}

/**
 * Resolves a single Ludusavi snapshot directory under the game backup dir.
 * `backupId` `.` means the game backup root (solo full backup).
 *
 * @param gameDir - Absolute path to `{config}/backup/{title}`.
 * @param backupId - Safe Ludusavi snapshot name.
 */
export function resolveLudusaviSnapshotDir(gameDir: string, backupId: string): string {
  const id = String(backupId || '').trim()
  if (!id || id.length > 200 || /[\\/\0\r\n]/.test(id) || id.includes('..')) {
    throw new Error('Ludusavi backup id is unsafe.')
  }
  const root = path.resolve(gameDir)
  if (id === '.') {
    return root
  }
  const snapshotDir = path.resolve(root, id)
  const rel = path.relative(root, snapshotDir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ludusavi snapshot path escapes game backup dir.')
  }
  return snapshotDir
}

/**
 * Keeps only Ludusavi snapshot rows whose directories still exist on disk.
 * `ludusavi backups --api` can list deleted folders until Ludusavi reindexes.
 *
 * @param gameDir - Absolute `{backupRoot}/{title}` path.
 * @param snapshots - Rows from `backups --api`.
 */
export function filterExistingLudusaviSnapshots<T extends { id: string }>(
  gameDir: string,
  snapshots: readonly T[]
): T[] {
  const root = path.resolve(gameDir)
  if (!fs.existsSync(root)) return []
  return snapshots.filter((snap) => {
    try {
      const dir = resolveLudusaviSnapshotDir(root, snap.id)
      return fs.existsSync(dir)
    } catch {
      return false
    }
  })
}

/** Marker filename written inside AchieveMe-downloaded cloud snapshot folders. */
export const ACHIEVEME_CLOUD_MARKER = '.achieveme-cloud'

/** Prefix for local folders that hold a downloaded R2 artifact. */
export const CLOUD_SNAPSHOT_ID_PREFIX = 'cloud-'

export type CloudSnapshotMarker = {
  artifactId: string
  createdAt: string
}

/**
 * Ludusavi backup id for a downloaded cloud artifact (`cloud-{artifactId}`).
 */
export function cloudSnapshotBackupId(artifactId: string): string {
  const id = String(artifactId || '')
    .trim()
    .toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(id)) {
    throw new Error('Cloud artifact id is invalid.')
  }
  return `${CLOUD_SNAPSHOT_ID_PREFIX}${id}`
}

/**
 * True when a backup id is an AchieveMe cloud download folder.
 */
export function isCloudSnapshotBackupId(backupId: string): boolean {
  const id = String(backupId || '').trim()
  return /^cloud-[a-f0-9]{32}$/i.test(id)
}

/**
 * Writes the cloud marker into a snapshot directory.
 */
export function writeCloudSnapshotMarker(
  snapshotDir: string,
  marker: CloudSnapshotMarker
): void {
  const payload = JSON.stringify({
    artifactId: marker.artifactId,
    createdAt: marker.createdAt
  })
  fs.writeFileSync(path.join(snapshotDir, ACHIEVEME_CLOUD_MARKER), payload, 'utf8')
}

/**
 * Reads a cloud marker if present.
 */
export function readCloudSnapshotMarker(snapshotDir: string): CloudSnapshotMarker | null {
  const file = path.join(snapshotDir, ACHIEVEME_CLOUD_MARKER)
  try {
    if (!fs.existsSync(file)) return null
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CloudSnapshotMarker>
    const artifactId = String(parsed.artifactId || '').trim().toLowerCase()
    const createdAt = String(parsed.createdAt || '').trim()
    if (!/^[a-f0-9]{32}$/.test(artifactId)) return null
    return { artifactId, createdAt }
  } catch {
    return null
  }
}

/**
 * Lists AchieveMe cloud snapshot folders under a game backup dir (disk only).
 */
export function listCloudSnapshotFolders(gameDir: string): Array<{
  id: string
  when: string
  whenMs: number
}> {
  const root = path.resolve(gameDir)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return []
  const out: Array<{ id: string; when: string; whenMs: number }> = []
  for (const name of fs.readdirSync(root)) {
    if (!isCloudSnapshotBackupId(name)) continue
    const dir = path.join(root, name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(dir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const marker = readCloudSnapshotMarker(dir)
    if (!marker) continue
    const when = marker.createdAt || ''
    const whenMs = when ? Date.parse(when) : stat.mtimeMs
    out.push({
      id: name,
      when,
      whenMs: Number.isFinite(whenMs) ? whenMs : stat.mtimeMs
    })
  }
  return out
}

/**
 * Returns absolute path to mapping.yaml under a snapshot/game dir (root preferred).
 */
export function findMappingYamlInSnapshotDir(snapshotDir: string): string | null {
  const root = path.resolve(snapshotDir)
  const direct = path.join(root, 'mapping.yaml')
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct
  }
  try {
    for (const name of fs.readdirSync(root)) {
      const child = path.join(root, name)
      let stat: fs.Stats
      try {
        stat = fs.statSync(child)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue
      const nested = path.join(child, 'mapping.yaml')
      if (fs.existsSync(nested) && fs.statSync(nested).isFile()) {
        return nested
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Game-root metadata files to merge into a named-snapshot archive when missing there.
 */
export function listGameRootMetadataToBundle(
  gameDir: string,
  snapshotDir: string
): Array<{ absolutePath: string; relativePath: string }> {
  const root = path.resolve(gameDir)
  const snap = path.resolve(snapshotDir)
  if (root === snap) return []
  const out: Array<{ absolutePath: string; relativePath: string }> = []
  for (const name of ['mapping.yaml', 'registry.yaml'] as const) {
    const fromGame = path.join(root, name)
    const inSnap = path.join(snap, name)
    if (!fs.existsSync(fromGame) || !fs.statSync(fromGame).isFile()) continue
    if (fs.existsSync(inSnap)) continue
    out.push({ absolutePath: fromGame, relativePath: name })
  }
  return out
}

/**
 * Copies game-root `mapping.yaml` / `registry.yaml` into `destDir` when missing there.
 * Used for named-snapshot archives and for staging older cloud downloads that lack mapping.
 *
 * @returns Relative paths that were copied.
 */
export async function mergeGameRootMetadataIntoDir(
  gameDir: string,
  destDir: string
): Promise<string[]> {
  const extras = listGameRootMetadataToBundle(gameDir, destDir)
  const copied: string[] = []
  for (const extra of extras) {
    const target = path.join(destDir, extra.relativePath)
    await fs.promises.copyFile(extra.absolutePath, target)
    copied.push(extra.relativePath)
  }
  return copied
}

function yamlDoubleQuote(value: string): string {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Reads `drives:` entries from an existing Ludusavi mapping.yaml (best-effort).
 */
export function parseLudusaviMappingDrives(mappingText: string): Record<string, string> {
  const out: Record<string, string> = {}
  const block = /(?:^|\n)drives:\s*\r?\n([\s\S]*?)(?=\n[a-zA-Z][\w]*:|\n*$)/.exec(
    mappingText.startsWith('drives:') ? `\n${mappingText}` : mappingText
  )
  if (!block) return out
  for (const line of block[1].split(/\r?\n/)) {
    const m = /^[ \t]+(drive-[\w-]+):\s*(.+?)\s*$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function defaultDriveRoot(driveDirName: string): string {
  const id = driveDirName.replace(/^drive-/i, '')
  if (/^[A-Za-z]$/.test(id)) return `${id.toUpperCase()}:`
  if (id === '0') return '/'
  return `${id}:`
}

/**
 * Writes a single-backup (`name: "."`) mapping.yaml for a staged/simple backup tree
 * that has `drive-*` folders at the root. Avoids multi-backup game-root mappings that
 * point Ludusavi at missing `backup-<timestamp>/` children.
 */
export async function writeNormalizedLudusaviMappingYaml(
  backupTreeDir: string,
  title: string,
  options?: { drivesHintPath?: string | null; outputPath?: string }
): Promise<string> {
  const drives: Record<string, string> = {}
  const hintPath = String(options?.drivesHintPath || '').trim()
  if (hintPath && fs.existsSync(hintPath)) {
    Object.assign(drives, parseLudusaviMappingDrives(fs.readFileSync(hintPath, 'utf8')))
  }

  const files: Array<{ absPath: string; size: number; hash: string }> = []
  const top = await fs.promises.readdir(backupTreeDir, { withFileTypes: true })
  for (const ent of top) {
    if (!ent.isDirectory()) continue
    if (!/^drive-/i.test(ent.name)) continue
    if (!drives[ent.name]) {
      drives[ent.name] = defaultDriveRoot(ent.name)
    }
    const root = drives[ent.name]
    const driveAbs = path.join(backupTreeDir, ent.name)
    for await (const entry of walkFiles(driveAbs)) {
      if (entry.isDirectory) continue
      const rel = entry.relativePath.replace(/\\/g, '/')
      const absPath = root.endsWith(':')
        ? `${root}/${rel}`
        : `${root.replace(/\/$/, '')}/${rel}`
      const buf = await fs.promises.readFile(entry.absolutePath)
      files.push({
        absPath,
        size: entry.size,
        hash: crypto.createHash('sha1').update(buf).digest('hex')
      })
    }
  }

  if (files.length === 0) {
    throw new Error('No drive-* backup files found to build mapping.yaml.')
  }

  let yaml = `---\nname: ${yamlDoubleQuote(title)}\ndrives:\n`
  for (const [key, value] of Object.entries(drives)) {
    yaml += `  ${key}: ${yamlDoubleQuote(value)}\n`
  }
  yaml += `backups:\n  - name: "."\n    when: ${yamlDoubleQuote(new Date().toISOString())}\n    os: windows\n    files:\n`
  for (const file of files) {
    yaml += `      ${yamlDoubleQuote(file.absPath)}:\n        hash: ${file.hash}\n        size: ${file.size}\n`
  }
  yaml += `    registry:\n      hash: ~\n    children: []\n`

  const mappingPath = String(options?.outputPath || '').trim() || path.join(backupTreeDir, 'mapping.yaml')
  await fs.promises.mkdir(path.dirname(mappingPath), { recursive: true })
  await fs.promises.writeFile(mappingPath, yaml, 'utf8')
  return mappingPath
}

/**
 * Prepares an empty `cloud-{artifactId}` directory under the game backup root.
 * Replaces only that folder if it already exists; never removes sibling snapshots.
 */
export async function prepareCloudSnapshotExtractDir(
  gameDir: string,
  artifactId: string
): Promise<string> {
  const backupId = cloudSnapshotBackupId(artifactId)
  const snapshotDir = resolveLudusaviSnapshotDir(gameDir, backupId)
  await fs.promises.mkdir(path.resolve(gameDir), { recursive: true })
  await fs.promises.rm(snapshotDir, { recursive: true, force: true })
  await fs.promises.mkdir(snapshotDir, { recursive: true })
  return snapshotDir
}


/**
 * Splits a posix path into ustar name (≤100) + prefix (≤155) when possible.
 * Returns null when GNU long-name is required.
 */
export function trySplitUstarPath(posixPath: string): { name: string; prefix: string } | null {
  const name = String(posixPath || '').replace(/\\/g, '/')
  const bytes = Buffer.from(name, 'utf8')
  if (bytes.length <= 100) {
    return { name, prefix: '' }
  }
  // Prefer splitting on `/` so name and prefix are valid path segments.
  for (let i = Math.min(bytes.length - 1, 100 + 155); i >= 1; i -= 1) {
    if (name[i] !== '/') continue
    const prefix = name.slice(0, i)
    const base = name.slice(i + 1)
    if (!base) continue
    const prefixBytes = Buffer.from(prefix, 'utf8')
    const baseBytes = Buffer.from(base, 'utf8')
    if (prefixBytes.length <= 155 && baseBytes.length <= 100) {
      return { name: base, prefix }
    }
  }
  return null
}

function writeUstarHeaderFields(input: {
  name: string
  prefix: string
  size: number
  typeFlag: string
  mtimeSec: number
}): Buffer {
  const buf = Buffer.alloc(512, 0)
  const nameBytes = Buffer.from(input.name, 'utf8')
  const prefixBytes = Buffer.from(input.prefix, 'utf8')
  if (nameBytes.length > 100) {
    throw new Error(`Archive entry name too long: ${input.name}`)
  }
  if (prefixBytes.length > 155) {
    throw new Error(`Archive entry prefix too long: ${input.prefix}`)
  }
  nameBytes.copy(buf, 0)
  buf.write('0000644\0', 100, 'utf8') // mode
  buf.write('0000000\0', 108, 'utf8') // uid
  buf.write('0000000\0', 116, 'utf8') // gid
  const sizeOct = input.size.toString(8).padStart(11, '0') + '\0'
  buf.write(sizeOct, 124, 'utf8')
  const mtimeOct = Math.max(0, Math.floor(input.mtimeSec)).toString(8).padStart(11, '0') + '\0'
  buf.write(mtimeOct, 136, 'utf8')
  buf.write('        ', 148, 'utf8') // checksum placeholder
  buf.write(input.typeFlag, 156, 'utf8')
  buf.write('ustar\0', 257, 'utf8')
  buf.write('00', 263, 'utf8')
  if (prefixBytes.length > 0) {
    prefixBytes.copy(buf, 345)
  }

  let sum = 0
  for (let i = 0; i < 512; i += 1) sum += buf[i]
  const checksum = sum.toString(8).padStart(6, '0') + '\0 '
  buf.write(checksum, 148, 'utf8')
  return buf
}

/**
 * Yields one or more 512-byte tar header blocks for an entry.
 * Uses ustar prefix when possible; otherwise GNU `@LongLink` (type L).
 */
export function* yieldTarEntryHeaderBlocks(
  entryPath: string,
  size: number,
  typeFlag: string,
  mtimeSec: number
): Generator<Buffer> {
  const posix = String(entryPath || '').replace(/\\/g, '/')
  const split = trySplitUstarPath(posix)
  if (split) {
    yield writeUstarHeaderFields({
      name: split.name,
      prefix: split.prefix,
      size,
      typeFlag,
      mtimeSec
    })
    return
  }

  const nameBytes = Buffer.from(posix, 'utf8')
  const longPayload = Buffer.concat([nameBytes, Buffer.alloc(1, 0)])
  yield writeUstarHeaderFields({
    name: '././@LongLink',
    prefix: '',
    size: longPayload.length,
    typeFlag: 'L',
    mtimeSec
  })
  yield longPayload
  const pad = (512 - (longPayload.length % 512)) % 512
  if (pad > 0) yield Buffer.alloc(pad, 0)

  const truncated = nameBytes.subarray(0, Math.min(100, nameBytes.length)).toString('latin1')
  yield writeUstarHeaderFields({
    name: truncated,
    prefix: '',
    size,
    typeFlag,
    mtimeSec
  })
}

function readTarHeaderName(header: Buffer): string {
  const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
  const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
  if (prefix) return `${prefix}/${name}`
  return name
}

async function* walkFiles(rootDir: string): AsyncGenerator<{
  absolutePath: string
  relativePath: string
  size: number
  mtimeSec: number
  isDirectory: boolean
}> {
  const stack = ['.']
  while (stack.length > 0) {
    const rel = stack.pop()!
    const abs = path.join(rootDir, rel)
    const stat = await fs.promises.stat(abs)
    if (stat.isDirectory()) {
      if (rel !== '.') {
        yield {
          absolutePath: abs,
          relativePath: rel.replace(/\\/g, '/'),
          size: 0,
          mtimeSec: stat.mtimeMs / 1000,
          isDirectory: true
        }
      }
      const entries = await fs.promises.readdir(abs)
      for (const entry of entries.sort().reverse()) {
        stack.push(rel === '.' ? entry : path.join(rel, entry))
      }
      continue
    }
    if (!stat.isFile()) continue
    yield {
      absolutePath: abs,
      relativePath: rel.replace(/\\/g, '/'),
      size: stat.size,
      mtimeSec: stat.mtimeMs / 1000,
      isDirectory: false
    }
  }
}

/**
 * Streams a gzipped ustar archive of a Ludusavi game backup directory.
 * When `backupId` is set, archives only that snapshot folder.
 */
export async function createLudusaviBackupArchive(input: {
  configDir: string
  title: string
  appid: string
  outputDir: string
  artifactId: string
  /** Optional Ludusavi snapshot name; omit to archive the whole title dir. */
  backupId?: string
}): Promise<ArchiveResult> {
  const gameDir = resolveLudusaviGameBackupDir(input.configDir, input.title)
  if (!fs.existsSync(gameDir) || !fs.statSync(gameDir).isDirectory()) {
    throw new Error('Ludusavi backup directory was not found.')
  }

  let sourceDir = gameDir
  const backupId = String(input.backupId || '').trim()
  if (backupId) {
    const snapshotDir = resolveLudusaviSnapshotDir(gameDir, backupId)
    if (fs.existsSync(snapshotDir) && fs.statSync(snapshotDir).isDirectory()) {
      // Named snapshot folders, or `.` (game root).
      sourceDir = snapshotDir
    } else if (backupId === '.') {
      sourceDir = gameDir
    } else {
      // Ludusavi "simple" format often keeps the full backup at the game root
      // even when the API reports a timestamp-like name.
      sourceDir = gameDir
    }
  }

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error('Ludusavi snapshot directory was not found.')
  }

  let fileCount = 0
  for await (const entry of walkFiles(sourceDir)) {
    if (entry.isDirectory) continue
    if (entry.relativePath.replace(/\\/g, '/') === 'mapping.yaml') continue
    fileCount += 1
  }
  const extras =
    sourceDir !== gameDir
      ? listGameRootMetadataToBundle(gameDir, sourceDir).filter(
          (e) => e.relativePath !== 'mapping.yaml'
        )
      : []
  fileCount += extras.length

  const tempMapDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'achieveme-norm-map-'))
  const normalizedMapPath = path.join(tempMapDir, 'mapping.yaml')
  let hasNormalizedMap = false
  try {
    await writeNormalizedLudusaviMappingYaml(sourceDir, input.title, {
      drivesHintPath: path.join(gameDir, 'mapping.yaml'),
      outputPath: normalizedMapPath
    })
    extras.push({ absolutePath: normalizedMapPath, relativePath: 'mapping.yaml' })
    hasNormalizedMap = true
    fileCount += 1
  } catch {
    const parentMap = path.join(gameDir, 'mapping.yaml')
    const snapMap = path.join(sourceDir, 'mapping.yaml')
    if (fs.existsSync(snapMap)) {
      // keep walk inclusion below
    } else if (sourceDir !== gameDir && fs.existsSync(parentMap)) {
      extras.push({ absolutePath: parentMap, relativePath: 'mapping.yaml' })
      fileCount += 1
    }
  }

  if (fileCount === 0) {
    await fs.promises.rm(tempMapDir, { recursive: true, force: true }).catch(() => undefined)
    throw new Error('Ludusavi backup directory is empty.')
  }

  await fs.promises.mkdir(input.outputDir, { recursive: true })
  const archivePath = path.join(
    input.outputDir,
    `${input.appid}-${input.artifactId}.tar.gz`
  )

  const hash = crypto.createHash('sha256')
  let bytes = 0
  const counting = new Transform({
    transform(chunk, _enc, cb) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buf.length
      if (bytes > MAX_CLOUD_SAVE_ARTIFACT_BYTES) {
        cb(new Error('cloud_save_snapshot_too_large'))
        return
      }
      hash.update(buf)
      cb(null, buf)
    }
  })

  const gzip = zlib.createGzip()
  const out = fs.createWriteStream(archivePath)

  async function* yieldFileEntry(absolutePath: string, relativePath: string, size: number, mtimeSec: number) {
    yield* yieldTarEntryHeaderBlocks(relativePath, size, '0', mtimeSec)
    const fh = await fs.promises.open(absolutePath, 'r')
    try {
      const stream = fh.createReadStream()
      for await (const chunk of stream) {
        yield chunk
      }
    } finally {
      await fh.close()
    }
    const pad = (512 - (size % 512)) % 512
    if (pad > 0) yield Buffer.alloc(pad, 0)
  }

  const tarReadable = Readable.from(
    (async function* () {
      for await (const entry of walkFiles(sourceDir)) {
        if (
          !entry.isDirectory &&
          entry.relativePath.replace(/\\/g, '/') === 'mapping.yaml' &&
          hasNormalizedMap
        ) {
          continue
        }
        const name = entry.isDirectory
          ? `${entry.relativePath}/`
          : entry.relativePath
        yield* yieldTarEntryHeaderBlocks(
          name,
          entry.isDirectory ? 0 : entry.size,
          entry.isDirectory ? '5' : '0',
          entry.mtimeSec
        )
        if (entry.isDirectory) continue
        const fh = await fs.promises.open(entry.absolutePath, 'r')
        try {
          const stream = fh.createReadStream()
          for await (const chunk of stream) {
            yield chunk
          }
        } finally {
          await fh.close()
        }
        const pad = (512 - (entry.size % 512)) % 512
        if (pad > 0) yield Buffer.alloc(pad, 0)
      }
      for (const extra of extras) {
        const stat = await fs.promises.stat(extra.absolutePath)
        yield* yieldFileEntry(
          extra.absolutePath,
          extra.relativePath,
          stat.size,
          stat.mtimeMs / 1000
        )
      }
      yield Buffer.alloc(1024, 0)
    })()
  )

  try {
    await pipeline(tarReadable, gzip, counting, out)
  } catch (error) {
    await fs.promises.unlink(archivePath).catch(() => undefined)
    throw error
  } finally {
    await fs.promises.rm(tempMapDir, { recursive: true, force: true }).catch(() => undefined)
  }

  if (!isWithinCloudSaveArtifactCap(bytes)) {
    await fs.promises.unlink(archivePath).catch(() => undefined)
    throw new Error('cloud_save_snapshot_too_large')
  }

  return {
    archivePath,
    bytes,
    sha256: hash.digest('hex')
  }
}

/**
 * Ensures an extracted relative path stays under destRoot (tar-slip guard).
 */
export function assertSafeExtractRelativePath(destRoot: string, relativePath: string): string {
  const clean = String(relativePath || '').replace(/\\/g, '/')
  if (!clean || clean.startsWith('/') || clean.split('/').includes('..')) {
    throw new Error('Unsafe archive entry path.')
  }
  const target = path.resolve(destRoot, clean)
  const rel = path.relative(path.resolve(destRoot), target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Unsafe archive entry path.')
  }
  return target
}

/**
 * Extracts a gzipped ustar archive into destRoot with path-escape checks.
 */
export async function extractLudusaviBackupArchive(
  archivePath: string,
  destRoot: string
): Promise<void> {
  await fs.promises.mkdir(destRoot, { recursive: true })
  const gunzip = zlib.createGunzip()
  const input = fs.createReadStream(archivePath)
  const chunks: Buffer[] = []
  await pipeline(
    input,
    gunzip,
    new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        cb()
      }
    })
  )
  const data = Buffer.concat(chunks)
  let offset = 0
  let pendingLongName: string | null = null
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512)
    offset += 512
    if (header.every((b) => b === 0)) break
    const typeFlag = String.fromCharCode(header[156] || 0)
    const sizeOct = header.subarray(124, 135).toString('utf8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeOct || '0', 8) || 0
    const content = data.subarray(offset, offset + size)
    offset += size + ((512 - (size % 512)) % 512)

    if (typeFlag === 'L') {
      pendingLongName = content.toString('utf8').replace(/\0.*$/, '')
      continue
    }

    const name = (pendingLongName || readTarHeaderName(header)).replace(/\/$/, '')
    pendingLongName = null
    const target = assertSafeExtractRelativePath(destRoot, name)
    if (typeFlag === '5' || name.endsWith('/')) {
      await fs.promises.mkdir(target, { recursive: true })
    } else {
      await fs.promises.mkdir(path.dirname(target), { recursive: true })
      await fs.promises.writeFile(target, content)
    }
  }
}

/**
 * Prunes the oldest local Ludusavi snapshot directories in a game's backup directory,
 * keeping at most `limit` newest snapshots.
 *
 * Rules:
 * - Skips cloud snapshots (`isCloudSnapshotBackupId` / starting with `cloud-`)
 * - Protects mapping.yaml and files (only inspects directories)
 * - Safe path checking (must be strictly inside gameBackupDir)
 * - Sorts by timestamp in name or mtimeMs descending (newest first)
 * - Deletes any snapshot beyond `limit`
 * - Non-blocking error handling
 *
 * @param gameBackupDir - Absolute path to `{backupRoot}/{title}` directory.
 * @param limit - Max number of local snapshots to retain (default: 5).
 */
export async function pruneOldLudusaviSnapshots(
  gameBackupDir: string,
  limit: number = 5
): Promise<{ pruned: number }> {
  const root = path.resolve(String(gameBackupDir || '').trim())
  if (!root || limit <= 0) return { pruned: 0 }

  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return { pruned: 0 }
    }
  } catch {
    return { pruned: 0 }
  }

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true })
  } catch {
    return { pruned: 0 }
  }

  const snapshots: Array<{ name: string; fullPath: string; timeMs: number }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const name = entry.name
    // Skip cloud snapshots
    if (isCloudSnapshotBackupId(name)) continue
    // Skip hidden folders
    if (name.startsWith('.')) continue

    const fullPath = path.resolve(root, name)
    if (!isDirInsideRoot(root, fullPath)) continue

    let timeMs = 0
    const compactMatch = /^backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(.*)$/i.exec(name)
    if (compactMatch) {
      const iso = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}T${compactMatch[4]}:${compactMatch[5]}:${compactMatch[6]}${compactMatch[7] || 'Z'}`
      const parsed = Date.parse(iso)
      if (Number.isFinite(parsed) && parsed > 0) timeMs = parsed
    }

    if (!timeMs) {
      const isoLike = name.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})[-_](\d{2})[-_](\d{2})(.*)$/, '$1T$2:$3:$4$5')
      const parsedIso = Date.parse(isoLike)
      if (Number.isFinite(parsedIso) && parsedIso > 0) {
        timeMs = parsedIso
      } else {
        const direct = Date.parse(name)
        if (Number.isFinite(direct) && direct > 0) {
          timeMs = direct
        } else {
          try {
            const stat = fs.statSync(fullPath)
            timeMs = stat.mtimeMs
          } catch {
            timeMs = 0
          }
        }
      }
    }

    snapshots.push({ name, fullPath, timeMs })
  }

  snapshots.sort((a, b) => b.timeMs - a.timeMs)

  if (snapshots.length <= limit) {
    return { pruned: 0 }
  }

  const toPrune = snapshots.slice(limit)
  let prunedCount = 0

  for (const snap of toPrune) {
    try {
      if (isDirInsideRoot(root, snap.fullPath) && !isCloudSnapshotBackupId(snap.name)) {
        await fs.promises.rm(snap.fullPath, { recursive: true, force: true })
        prunedCount++
      }
    } catch {
      // Ignore individual deletion failures
    }
  }

  return { pruned: prunedCount }
}

