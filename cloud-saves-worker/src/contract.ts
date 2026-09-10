/** Max archive size (Hydra snapshot cap). */
export const MAX_ARTIFACT_BYTES = 2_147_483_647

/** Max retained artifacts per appid. */
export const MAX_ARTIFACTS_PER_APPID = 5

const APPID_RE = /^\d+$/
const SHA256_RE = /^[a-f0-9]{64}$/
const ARTIFACT_ID_RE = /^[a-f0-9]{32}$/

export type PrepareArtifactBody = {
  appid: string
  bytes: number
  sha256: string
}

export type CompleteArtifactBody = {
  appid: string
  sha256: string
  bytes: number
}

export class ContractError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ContractError'
    this.status = status
  }
}

/**
 * Validates a Steam AppID for cloud object keys.
 */
export function assertAppid(value: unknown): string {
  if (typeof value !== 'string' || !APPID_RE.test(value)) {
    throw new ContractError(400, 'Invalid appid')
  }
  return value
}

/**
 * Validates a lowercase hex SHA-256 digest.
 */
export function assertSha256(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new ContractError(400, 'Invalid sha256')
  }
  return value
}

/**
 * Validates artifact byte length.
 */
export function assertBytes(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_ARTIFACT_BYTES
  ) {
    throw new ContractError(400, 'Invalid bytes')
  }
  return value
}

/**
 * Validates a 32-char hex artifact id (no path segments).
 */
export function assertArtifactId(value: unknown): string {
  if (typeof value !== 'string' || !ARTIFACT_ID_RE.test(value)) {
    throw new ContractError(400, 'Invalid artifact id')
  }
  return value
}

/**
 * Builds the R2 object key for an artifact.
 */
export function artifactObjectKey(appid: string, id: string): string {
  assertAppid(appid)
  assertArtifactId(id)
  return `saves/${appid}/${id}.tar.gz`
}

/**
 * Parses and validates POST /v1/artifacts body.
 */
export function parsePrepareBody(body: unknown): PrepareArtifactBody {
  if (!body || typeof body !== 'object') {
    throw new ContractError(400, 'Invalid body')
  }
  const record = body as Record<string, unknown>
  return {
    appid: assertAppid(record.appid),
    bytes: assertBytes(record.bytes),
    sha256: assertSha256(record.sha256)
  }
}

/**
 * Parses and validates POST /v1/artifacts/:id/complete body.
 */
export function parseCompleteBody(body: unknown): CompleteArtifactBody {
  if (!body || typeof body !== 'object') {
    throw new ContractError(400, 'Invalid body')
  }
  const record = body as Record<string, unknown>
  return {
    appid: assertAppid(record.appid),
    sha256: assertSha256(record.sha256),
    bytes: assertBytes(record.bytes)
  }
}

/**
 * Ensures HEAD Content-Length matches the prepare-time byte count.
 */
export function assertUploadedSizeMatches(
  actualSize: number | null,
  expectedBytes: number
): void {
  if (actualSize == null) {
    throw new ContractError(409, 'Uploaded object is missing')
  }
  if (actualSize !== expectedBytes) {
    throw new ContractError(409, 'Uploaded object size mismatch')
  }
}

/**
 * Creates a 32-char lowercase hex artifact id.
 */
export function createArtifactId(): string {
  return crypto.randomUUID().replace(/-/g, '').toLowerCase()
}
