import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings } from '../../shared/types'
import {
  buildCloudSavesAuthorizationHeader,
  cloudSavesConfigured,
  isCloudSaveAppid,
  isWithinCloudSaveArtifactCap,
  normalizeCloudSavesApiUrl,
  R2_CLOUD_TOO_LARGE_NOTE,
  R2_CLOUD_UPLOAD_FAILED_NOTE
} from '../../shared/r2CloudSaveUtils.ts'
import {
  createLudusaviBackupArchive,
  extractLudusaviBackupArchive,
  prepareCloudSnapshotExtractDir,
  resolveLudusaviGameBackupDir,
  writeCloudSnapshotMarker
} from './ludusaviBackupArchive.ts'
import { refreshAchieveMeLudusaviConfigFromGui } from './ludusaviService.ts'
import { cloudSavesError, cloudSavesLog, cloudSavesWarn } from './cloudSavesDebugLog.ts'

export type FetchLike = typeof fetch

export type CloudArtifactSummary = {
  id: string
  appid: string
  bytes: number
  sha256: string
  createdAt: string
}

export type UploadCloudSaveInput = {
  settings: Pick<AppSettings, 'cloudSavesApiUrl' | 'cloudSavesApiToken'>
  appid: string
  title: string
  configDir: string
  outputDir: string
  /** Optional Ludusavi snapshot id for manual upload. */
  backupId?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}

export type UploadCloudSaveResult =
  | { ok: true; id: string }
  | { ok: false; softNote: string }

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: buildCloudSavesAuthorizationHeader(token),
    ...(extra || {})
  }
}

/**
 * Uploads a Ludusavi game backup archive to the R2 Worker.
 * Failures return soft notes — never throw tokens.
 */
export async function uploadGameCloudSave(
  input: UploadCloudSaveInput
): Promise<UploadCloudSaveResult> {
  const { settings } = input
  cloudSavesLog('upload.start', {
    appid: input.appid,
    title: input.title,
    backupId: input.backupId || null
  })
  if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
    cloudSavesWarn('upload.skip', { reason: 'not-configured' })
    return { ok: false, softNote: '' }
  }
  if (!isCloudSaveAppid(input.appid)) {
    cloudSavesWarn('upload.skip', { reason: 'bad-appid', appid: input.appid })
    return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const timeoutMs = input.timeoutMs ?? 120_000
  let archivePath: string | null = null

  try {
    const apiUrl = normalizeCloudSavesApiUrl(settings.cloudSavesApiUrl)
    refreshAchieveMeLudusaviConfigFromGui()
    const artifactId = crypto.randomUUID().replace(/-/g, '').toLowerCase()
    const archive = await createLudusaviBackupArchive({
      configDir: input.configDir,
      title: input.title,
      appid: input.appid,
      outputDir: input.outputDir,
      artifactId,
      backupId: input.backupId
    })
    archivePath = archive.archivePath
    cloudSavesLog('upload.archive', {
      bytes: archive.bytes,
      sha256: archive.sha256.slice(0, 12),
      artifactId
    })

    if (!isWithinCloudSaveArtifactCap(archive.bytes)) {
      cloudSavesWarn('upload.too-large', { bytes: archive.bytes })
      return { ok: false, softNote: R2_CLOUD_TOO_LARGE_NOTE }
    }

    const prepareResponse = await fetchWithTimeout(
      fetchImpl,
      `${apiUrl}/v1/artifacts`,
      {
        method: 'POST',
        headers: authHeaders(settings.cloudSavesApiToken, {
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          appid: input.appid,
          bytes: archive.bytes,
          sha256: archive.sha256
        })
      },
      timeoutMs
    )
    if (prepareResponse.status === 401) {
      cloudSavesError('upload.prepare', { status: 401 })
      return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }
    if (!prepareResponse.ok) {
      cloudSavesError('upload.prepare', { status: prepareResponse.status })
      return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }
    const prepared = (await prepareResponse.json()) as {
      id?: string
      uploadUrl?: string
      requiredHeaders?: Record<string, string>
    }
    if (!prepared.id || !prepared.uploadUrl || !prepared.requiredHeaders) {
      cloudSavesError('upload.prepare.bad-body', {
        hasId: Boolean(prepared.id),
        hasUploadUrl: Boolean(prepared.uploadUrl),
        hasHeaders: Boolean(prepared.requiredHeaders)
      })
      return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }

    // Hydra legacy: axios.put(uploadUrl, fileBuffer, { headers: { "Content-Type": "application/tar" } })
    const archiveBytes = await fs.promises.readFile(archive.archivePath)
    if (archiveBytes.byteLength !== archive.bytes) {
      cloudSavesError('upload.size-mismatch', {
        expected: archive.bytes,
        actual: archiveBytes.byteLength
      })
      return {
        ok: false,
        softNote:
          'Cloud upload failed — archive size mismatch before PUT. Local backup is kept.'
      }
    }
    const putHeaders: Record<string, string> = {
      'Content-Type': prepared.requiredHeaders['Content-Type'] || 'application/gzip'
    }
    const putResponse = await fetchWithTimeout(
      fetchImpl,
      prepared.uploadUrl,
      {
        method: 'PUT',
        headers: putHeaders,
        body: archiveBytes
      },
      timeoutMs
    )
    if (!putResponse.ok) {
      cloudSavesError('upload.put', { status: putResponse.status })
      return {
        ok: false,
        softNote: `Cloud upload failed at R2 PUT (${putResponse.status}). Local backup is kept.`
      }
    }

    const completeResponse = await fetchWithTimeout(
      fetchImpl,
      `${apiUrl}/v1/artifacts/${prepared.id}/complete`,
      {
        method: 'POST',
        headers: authHeaders(settings.cloudSavesApiToken, {
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          appid: input.appid,
          sha256: archive.sha256,
          bytes: archive.bytes
        })
      },
      timeoutMs
    )
    if (!completeResponse.ok) {
      cloudSavesError('upload.complete', { status: completeResponse.status })
      return {
        ok: false,
        softNote: `Cloud upload failed at complete (${completeResponse.status}). Local backup is kept.`
      }
    }

    cloudSavesLog('upload.ok', { id: prepared.id, appid: input.appid })
    return { ok: true, id: prepared.id }
  } catch (error) {
    const detail = sanitizeErrorMessage(error)
    cloudSavesError('upload.exception', { detail })
    if (/backup directory was not found|snapshot directory was not found|empty/i.test(detail)) {
      return {
        ok: false,
        softNote: `Cloud upload failed — local Ludusavi backup folder not found (${detail}). Local backup status is unchanged.`
      }
    }
    return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
  } finally {
    if (archivePath) {
      await fs.promises.unlink(archivePath).catch(() => undefined)
    }
  }
}

/**
 * Lists cloud artifacts for one appid.
 */
export async function listGameCloudArtifacts(input: {
  settings: Pick<AppSettings, 'cloudSavesApiUrl' | 'cloudSavesApiToken'>
  appid: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<CloudArtifactSummary[]> {
  if (!cloudSavesConfigured(input.settings.cloudSavesApiUrl, input.settings.cloudSavesApiToken)) {
    return []
  }
  if (!isCloudSaveAppid(input.appid)) return []
  const apiUrl = normalizeCloudSavesApiUrl(input.settings.cloudSavesApiUrl)
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchWithTimeout(
    fetchImpl,
    `${apiUrl}/v1/artifacts?appid=${encodeURIComponent(input.appid)}`,
    {
      method: 'GET',
      headers: authHeaders(input.settings.cloudSavesApiToken)
    },
    input.timeoutMs ?? 60_000
  )
  if (!response.ok) {
    throw new Error(R2_CLOUD_UPLOAD_FAILED_NOTE)
  }
  const body = (await response.json()) as { artifacts?: CloudArtifactSummary[] }
  return Array.isArray(body.artifacts) ? body.artifacts : []
}

/**
 * Downloads one cloud artifact into `{gameDir}/cloud-{artifactId}/` without wiping siblings.
 * When `artifactId` is omitted, uses the newest remote artifact.
 */
export async function downloadGameCloudSave(input: {
  settings: Pick<AppSettings, 'cloudSavesApiUrl' | 'cloudSavesApiToken'>
  appid: string
  title: string
  configDir: string
  tempDir: string
  artifactId?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<{ ok: boolean; error?: string; backupId?: string }> {
  cloudSavesLog('download.start', {
    appid: input.appid,
    title: input.title,
    artifactId: input.artifactId || null
  })
  try {
    if (!cloudSavesConfigured(input.settings.cloudSavesApiUrl, input.settings.cloudSavesApiToken)) {
      cloudSavesWarn('download.skip', { reason: 'not-configured' })
      return { ok: false, error: 'Cloud saves are not configured.' }
    }
    if (!isCloudSaveAppid(input.appid)) {
      cloudSavesWarn('download.skip', { reason: 'bad-appid' })
      return { ok: false, error: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }

    const artifacts = await listGameCloudArtifacts(input)
    if (artifacts.length === 0) {
      cloudSavesWarn('download.none', { appid: input.appid })
      return { ok: false, error: 'No cloud backups found for this game.' }
    }
    const wanted = String(input.artifactId || '').trim().toLowerCase()
    const sorted = [...artifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const artifact = wanted
      ? sorted.find((a) => a.id.toLowerCase() === wanted)
      : sorted[0]
    if (!artifact) {
      return { ok: false, error: 'Selected cloud backup was not found.' }
    }

    const apiUrl = normalizeCloudSavesApiUrl(input.settings.cloudSavesApiUrl)
    const fetchImpl = input.fetchImpl ?? fetch
    const timeoutMs = input.timeoutMs ?? 120_000
    const dlMeta = await fetchWithTimeout(
      fetchImpl,
      `${apiUrl}/v1/artifacts/${artifact.id}/download?appid=${encodeURIComponent(input.appid)}`,
      {
        method: 'GET',
        headers: authHeaders(input.settings.cloudSavesApiToken)
      },
      timeoutMs
    )
    if (!dlMeta.ok) {
      cloudSavesError('download.meta', { status: dlMeta.status, id: artifact.id })
      return { ok: false, error: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }
    const { downloadUrl } = (await dlMeta.json()) as { downloadUrl?: string }
    if (!downloadUrl) {
      cloudSavesError('download.meta.no-url', { id: artifact.id })
      return { ok: false, error: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }
    const fileResponse = await fetchWithTimeout(
      fetchImpl,
      downloadUrl,
      { method: 'GET' },
      timeoutMs
    )
    if (!fileResponse.ok || !fileResponse.body) {
      cloudSavesError('download.get', { status: fileResponse.status })
      return { ok: false, error: R2_CLOUD_UPLOAD_FAILED_NOTE }
    }
    await fs.promises.mkdir(input.tempDir, { recursive: true })
    const archivePath = path.join(input.tempDir, `${input.appid}-${artifact.id}.tar.gz`)
    const fileStream = fs.createWriteStream(archivePath)
    const reader = fileResponse.body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) fileStream.write(Buffer.from(value))
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        fileStream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
      })
    }

    const gameDir = (() => {
      refreshAchieveMeLudusaviConfigFromGui()
      return resolveLudusaviGameBackupDir(input.configDir, input.title)
    })()
    const snapshotDir = await prepareCloudSnapshotExtractDir(gameDir, artifact.id)
    await extractLudusaviBackupArchive(archivePath, snapshotDir)
    writeCloudSnapshotMarker(snapshotDir, {
      artifactId: artifact.id,
      createdAt: artifact.createdAt || new Date().toISOString()
    })
    await fs.promises.unlink(archivePath).catch(() => undefined)
    const backupId = path.basename(snapshotDir)
    let entries: string[] = []
    try {
      entries = fs.readdirSync(snapshotDir).slice(0, 40)
    } catch {
      entries = []
    }
    cloudSavesLog('download.ok', {
      appid: input.appid,
      backupId,
      snapshotDir,
      entries
    })
    return { ok: true, backupId }
  } catch (error) {
    cloudSavesError('download.exception', {
      detail: sanitizeErrorMessage(error) || String(error)
    })
    return { ok: false, error: sanitizeErrorMessage(error) || R2_CLOUD_UPLOAD_FAILED_NOTE }
  }
}

/**
 * Downloads the newest cloud artifact into a local `cloud-*` snapshot folder (additive).
 */
export async function downloadNewestGameCloudSave(input: {
  settings: Pick<AppSettings, 'cloudSavesApiUrl' | 'cloudSavesApiToken'>
  appid: string
  title: string
  configDir: string
  tempDir: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<{ ok: boolean; error?: string }> {
  const result = await downloadGameCloudSave(input)
  return { ok: result.ok, error: result.error }
}
