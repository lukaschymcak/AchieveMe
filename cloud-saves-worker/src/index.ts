import { AwsClient } from 'aws4fetch'
import {
  artifactObjectKey,
  assertAppid,
  assertArtifactId,
  assertUploadedSizeMatches,
  ContractError,
  createArtifactId,
  parseCompleteBody,
  parsePrepareBody
} from './contract.ts'
import { assertBearerAuth } from './auth.ts'
import { createPresignedGetUrl, createPresignedPutUrl } from './presign.ts'
import { retainArtifactsForAppid } from './retention.ts'

export type WorkerEnv = {
  API_TOKEN: string
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET: string
  /**
   * Real R2 jurisdiction only (`eu` | `fedramp`).
   * Location hints like `eeur` are NOT jurisdictions — leave unset for those buckets.
   */
  R2_JURISDICTION?: string
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

function errorResponse(error: unknown): Response {
  if (error instanceof ContractError) {
    return json(error.status, { error: error.message })
  }
  return json(500, { error: 'Internal error' })
}

/**
 * Builds the S3 API endpoint.
 * Only real jurisdictions (`eu` | `fedramp`) get a host suffix; location hints do not.
 */
export function r2Endpoint(env: Pick<WorkerEnv, 'R2_ACCOUNT_ID' | 'R2_JURISDICTION'>): string {
  const account = String(env.R2_ACCOUNT_ID || '').trim()
  const jurisdiction = String(env.R2_JURISDICTION || '')
    .trim()
    .toLowerCase()
  if (jurisdiction === 'eu' || jurisdiction === 'fedramp') {
    return `https://${account}.${jurisdiction}.r2.cloudflarestorage.com`
  }
  return `https://${account}.r2.cloudflarestorage.com`
}

function createAwsClient(env: WorkerEnv): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto'
  })
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ContractError(400, 'Invalid JSON body')
  }
}

async function headObject(
  client: AwsClient,
  env: WorkerEnv,
  key: string
): Promise<{ ok: boolean; size: number | null; etag: string | null }> {
  const url = `${r2Endpoint(env)}/${env.R2_BUCKET}/${key}`
  const response = await client.fetch(url, { method: 'HEAD' })
  if (response.status === 404) {
    return { ok: false, size: null, etag: null }
  }
  if (!response.ok) {
    throw new ContractError(502, 'Failed to inspect uploaded object')
  }
  const length = response.headers.get('content-length')
  const size = length != null ? Number(length) : null
  return {
    ok: true,
    size: Number.isFinite(size) ? size : null,
    etag: response.headers.get('etag')
  }
}

/**
 * Cloudflare Worker fetch handler for AchieveMe cloud save artifacts.
 */
export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    assertBearerAuth(request, env.API_TOKEN)

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (request.method === 'POST' && path === '/v1/artifacts') {
      const body = parsePrepareBody(await readJsonBody(request))
      const id = createArtifactId()
      const key = artifactObjectKey(body.appid, id)
      // Hydra legacy artifacts: prepare → PUT with Content-Type only (no Content-Length in signed headers).
      const uploadUrl = await createPresignedPutUrl({
        client: createAwsClient(env),
        endpoint: r2Endpoint(env),
        bucket: env.R2_BUCKET,
        key
      })
      return json(200, {
        id,
        uploadUrl,
        requiredHeaders: {
          'Content-Type': 'application/gzip'
        }
      })
    }

    const completeMatch = /^\/v1\/artifacts\/([^/]+)\/complete$/.exec(path)
    if (request.method === 'POST' && completeMatch) {
      const id = assertArtifactId(completeMatch[1])
      const body = parseCompleteBody(await readJsonBody(request))
      const key = artifactObjectKey(body.appid, id)
      const client = createAwsClient(env)
      const head = await headObject(client, env, key)
      if (!head.ok) {
        throw new ContractError(409, 'Uploaded object is missing')
      }
      assertUploadedSizeMatches(head.size, body.bytes)
      await retainArtifactsForAppid({
        client,
        endpoint: r2Endpoint(env),
        bucket: env.R2_BUCKET,
        appid: body.appid,
        keep: 5
      })
      return json(200, { ok: true, id })
    }

    if (request.method === 'GET' && path === '/v1/artifacts') {
      const appid = assertAppid(url.searchParams.get('appid'))
      const client = createAwsClient(env)
      const listed = await retainArtifactsForAppid({
        client,
        endpoint: r2Endpoint(env),
        bucket: env.R2_BUCKET,
        appid,
        keep: Number.POSITIVE_INFINITY,
        deleteOldest: false
      })
      return json(200, {
        artifacts: listed.map((item) => ({
          id: item.id,
          appid,
          bytes: item.size,
          sha256: item.sha256 ?? '',
          createdAt: item.lastModified
        }))
      })
    }

    const downloadMatch = /^\/v1\/artifacts\/([^/]+)\/download$/.exec(path)
    if (request.method === 'GET' && downloadMatch) {
      const id = assertArtifactId(downloadMatch[1])
      const appid = assertAppid(url.searchParams.get('appid'))
      const key = artifactObjectKey(appid, id)
      const downloadUrl = await createPresignedGetUrl({
        client: createAwsClient(env),
        endpoint: r2Endpoint(env),
        bucket: env.R2_BUCKET,
        key
      })
      return json(200, { downloadUrl })
    }

    const deleteMatch = /^\/v1\/artifacts\/([^/]+)$/.exec(path)
    if (request.method === 'DELETE' && deleteMatch) {
      const id = assertArtifactId(deleteMatch[1])
      const appid = assertAppid(url.searchParams.get('appid'))
      const key = artifactObjectKey(appid, id)
      const client = createAwsClient(env)
      const objectUrl = `${r2Endpoint(env)}/${env.R2_BUCKET}/${key}`
      const response = await client.fetch(objectUrl, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) {
        throw new ContractError(502, 'Failed to delete artifact')
      }
      return json(200, { ok: true })
    }

    throw new ContractError(404, 'Not found')
  } catch (error) {
    return errorResponse(error)
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env)
  }
}
