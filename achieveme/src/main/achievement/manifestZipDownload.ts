import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

/** Injected fetch used by tests; production uses global fetch. */
export type ManifestFetch = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<Response>

/** Byte/progress payload forwarded to the renderer over IPC. */
export type ManifestDownloadProgress = {
  received: number
  total: number
  pct?: number
  done?: boolean
}

export interface DownloadManifestZipOptions {
  /** Absolute Hubcap (or test) URL for the ZIP. */
  url: string
  /** Absolute path for the finished ZIP. */
  destinationZipPath: string
  /** Injected fetch; defaults to global fetch. */
  fetchFn?: ManifestFetch
  /** Request headers (Authorization, etc.). */
  headers?: Record<string, string>
  /** Lazy header loader; runs inside the coalesced download so callers must not await it first. */
  resolveHeaders?: () => Promise<Record<string, string>>
  /** Maps HTTP status + JSON body to a thrown Error message. */
  mapHttpError?: (status: number, body: unknown) => string
  /** Optional progress callback (IPC in production). */
  onProgress?: (payload: ManifestDownloadProgress) => void
}

const inFlight = new Map<string, Promise<string>>()

/**
 * Builds the temp path used while streaming a ZIP to disk.
 *
 * @param destinationZipPath - Final ZIP path
 * @param nonce - Unique suffix so concurrent writers do not share a file
 */
export function manifestPartPath(destinationZipPath: string, nonce: string): string {
  return `${destinationZipPath}.part.${nonce}`
}

/** Clears in-flight downloads — tests only. */
export function resetManifestZipDownloadInFlightForTests(): void {
  inFlight.clear()
}

/**
 * Streams a manifest ZIP to `destinationZipPath` via a unique `.part` file, then rename.
 *
 * @param options - URL, dest path, optional fetch/headers/progress
 * @returns Absolute path of the finished ZIP
 */
export async function downloadManifestZip(options: DownloadManifestZipOptions): Promise<string> {
  const key = path.normalize(options.destinationZipPath)
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = downloadManifestZipOnce(options).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

async function downloadManifestZipOnce(options: DownloadManifestZipOptions): Promise<string> {
  const {
    url,
    destinationZipPath,
    fetchFn = fetch,
    mapHttpError,
    onProgress
  } = options

  await fsp.mkdir(path.dirname(destinationZipPath), { recursive: true })
  const headers =
    options.headers ?? (options.resolveHeaders ? await options.resolveHeaders() : {})
  const part = manifestPartPath(destinationZipPath, crypto.randomUUID())
  const response = await fetchFn(url, { headers })
  if (!response.ok || !response.body) {
    let body: unknown = {}
    try {
      body = await response.json()
    } catch {
      /* ignore */
    }
    const message = mapHttpError
      ? mapHttpError(response.status, body)
      : defaultHttpError(response.status, body)
    throw new Error(message)
  }

  const total = Number(response.headers.get('content-length') || 0)
  let received = 0
  const file = fs.createWriteStream(part)
  const finished = new Promise<void>((resolve, reject) => {
    file.on('finish', resolve)
    file.on('error', reject)
  })
  const reader = response.body.getReader()
  let promoted = false
  try {
    try {
      let reading = true
      while (reading) {
        const { done, value } = await reader.read()
        if (done) {
          reading = false
          break
        }
        if (!value) continue
        received += value.length
        file.write(Buffer.from(value))
        if (onProgress) {
          onProgress({
            received,
            total,
            pct: total > 0 ? Math.round((received * 100) / total) : undefined
          })
        }
      }
    } finally {
      file.end()
    }
    await finished
    await fsp.rename(part, destinationZipPath)
    promoted = true
    if (onProgress) {
      onProgress({ received, total, pct: 100, done: true })
    }
    return destinationZipPath
  } finally {
    if (!promoted) {
      await fsp.unlink(part).catch(() => undefined)
    }
  }
}

function defaultHttpError(code: number, body: unknown): string {
  const detail =
    typeof body === 'object' && body && 'detail' in body
      ? String((body as { detail: unknown }).detail)
      : ''
  return detail ? `API Error (${code}): ${detail}` : `API Error (${code})`
}
