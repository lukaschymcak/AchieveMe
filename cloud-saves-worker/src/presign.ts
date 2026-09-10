import { AwsClient } from 'aws4fetch'

export type PresignPutInput = {
  client: AwsClient
  endpoint: string
  bucket: string
  key: string
  expiresSeconds?: number
}

export type PresignGetInput = {
  client: AwsClient
  endpoint: string
  bucket: string
  key: string
  expiresSeconds?: number
}

/**
 * Creates a short-lived S3-compatible PUT URL for R2.
 * Matches Hydra legacy artifact upload: sign Content-Type only (no checksum / Content-Length).
 */
export async function createPresignedPutUrl(input: PresignPutInput): Promise<string> {
  const expires = input.expiresSeconds ?? 900
  const url = new URL(`${input.endpoint}/${input.bucket}/${input.key}`)
  url.searchParams.set('X-Amz-Expires', String(expires))

  const signed = await input.client.sign(
    new Request(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/gzip'
      }
    }),
    {
      aws: { signQuery: true }
    }
  )
  return signed.url
}

/**
 * Creates a short-lived S3-compatible GET URL for R2.
 */
export async function createPresignedGetUrl(input: PresignGetInput): Promise<string> {
  const expires = input.expiresSeconds ?? 900
  const url = new URL(`${input.endpoint}/${input.bucket}/${input.key}`)
  url.searchParams.set('X-Amz-Expires', String(expires))

  const signed = await input.client.sign(
    new Request(url.toString(), { method: 'GET' }),
    {
      aws: { signQuery: true }
    }
  )
  return signed.url
}
