/**
 * Pure helpers for AchieveMe ↔ R2 cloud-saves Worker contract.
 * No Node built-ins — safe for renderer imports.
 */

/** Soft note when cloud upload fails after a successful local Ludusavi backup. */
export const R2_CLOUD_UPLOAD_FAILED_NOTE =
  'Cloud upload failed. Local backup is kept. Check Worker URL, token, and network.'

/** Soft note when archive exceeds the Worker size cap. */
export const R2_CLOUD_TOO_LARGE_NOTE =
  'Cloud upload skipped — backup archive exceeds the 2 GiB limit. Local backup is kept.'

/** Max archive size (Hydra snapshot cap). */
export const MAX_CLOUD_SAVE_ARTIFACT_BYTES = 2_147_483_647

const APPID_RE = /^\d+$/
const SHA256_RE = /^[a-f0-9]{64}$/

/**
 * Returns true when the Worker base URL is allowed.
 * Requires https, or http://127.0.0.1 for local wrangler dev.
 */
export function isAllowedCloudSavesApiUrl(url: string): boolean {
  const raw = String(url || '').trim()
  if (!raw) return false
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol === 'https:') return true
  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
  ) {
    return true
  }
  return false
}

/**
 * Returns true when both URL and token are set and the URL is allowed.
 */
export function cloudSavesConfigured(apiUrl: string, apiToken: string): boolean {
  return isAllowedCloudSavesApiUrl(apiUrl) && String(apiToken || '').trim().length > 0
}

/**
 * Builds the Authorization header value. Never logs the token.
 */
export function buildCloudSavesAuthorizationHeader(apiToken: string): string {
  const token = String(apiToken || '').trim()
  if (!token) {
    throw new Error('Cloud saves API token is empty.')
  }
  return `Bearer ${token}`
}

/**
 * Normalizes and validates the Worker base URL (no trailing slash).
 */
export function normalizeCloudSavesApiUrl(apiUrl: string): string {
  const raw = String(apiUrl || '').trim().replace(/\/+$/, '')
  if (!isAllowedCloudSavesApiUrl(raw)) {
    throw new Error('Cloud saves API URL must be https (or http://127.0.0.1 for local dev).')
  }
  return raw
}

/**
 * Hostname-only label for status UI (never includes token).
 */
export function cloudSavesApiUrlHost(apiUrl: string): string | null {
  const raw = String(apiUrl || '').trim()
  if (!raw) return null
  try {
    return new URL(raw).host
  } catch {
    return null
  }
}

/**
 * Validates a numeric Steam AppID for cloud keys.
 */
export function isCloudSaveAppid(appid: string): boolean {
  return APPID_RE.test(String(appid || '').trim())
}

/**
 * Validates a lowercase hex SHA-256 digest.
 */
export function isCloudSaveSha256(value: string): boolean {
  return SHA256_RE.test(String(value || '').trim())
}

/**
 * Returns true when the byte length is within the upload cap.
 */
export function isWithinCloudSaveArtifactCap(bytes: number): boolean {
  return Number.isSafeInteger(bytes) && bytes >= 1 && bytes <= MAX_CLOUD_SAVE_ARTIFACT_BYTES
}
