import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AwsClient } from 'aws4fetch'
import { createPresignedGetUrl, createPresignedPutUrl } from './presign.ts'
import { artifactIdFromKey, retainArtifactsForAppid } from './retention.ts'

const endpoint = 'https://e692a40bf42b6ba9418249700af7a1b1.r2.cloudflarestorage.com'

test('createPresignedPutUrl returns https URL on R2 endpoint host', async () => {
  const client = new AwsClient({
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secretsecretsecretsecretsecretsecre',
    service: 's3',
    region: 'auto'
  })
  const url = await createPresignedPutUrl({
    client,
    endpoint,
    bucket: 'achieveme-saves',
    key: 'saves/10/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.tar.gz'
  })
  const parsed = new URL(url)
  assert.equal(parsed.protocol, 'https:')
  assert.equal(parsed.host, 'e692a40bf42b6ba9418249700af7a1b1.r2.cloudflarestorage.com')
  assert.match(url, /X-Amz-Signature=/i)
  assert.doesNotMatch(url, /checksum/i)
})

test('createPresignedGetUrl returns https URL', async () => {
  const client = new AwsClient({
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secretsecretsecretsecretsecretsecre',
    service: 's3',
    region: 'auto'
  })
  const url = await createPresignedGetUrl({
    client,
    endpoint,
    bucket: 'achieveme-saves',
    key: 'saves/10/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.tar.gz'
  })
  assert.equal(new URL(url).protocol, 'https:')
})

test('r2Endpoint ignores location hints; only eu|fedramp get a suffix', async () => {
  const { r2Endpoint } = await import('./index.ts')
  assert.equal(
    r2Endpoint({
      R2_ACCOUNT_ID: 'e692a40bf42b6ba9418249700af7a1b1',
      R2_JURISDICTION: 'eeur'
    }),
    'https://e692a40bf42b6ba9418249700af7a1b1.r2.cloudflarestorage.com'
  )
  assert.equal(
    r2Endpoint({
      R2_ACCOUNT_ID: 'e692a40bf42b6ba9418249700af7a1b1',
      R2_JURISDICTION: 'eu'
    }),
    'https://e692a40bf42b6ba9418249700af7a1b1.eu.r2.cloudflarestorage.com'
  )
  assert.equal(
    r2Endpoint({ R2_ACCOUNT_ID: 'e692a40bf42b6ba9418249700af7a1b1' }),
    'https://e692a40bf42b6ba9418249700af7a1b1.r2.cloudflarestorage.com'
  )
})

test('artifactIdFromKey parses valid keys and rejects escapes', () => {
  assert.equal(
    artifactIdFromKey('saves/10/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.tar.gz', '10'),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )
  assert.equal(artifactIdFromKey('saves/10/../evil.tar.gz', '10'), null)
})

test('retainArtifactsForAppid deletes oldest beyond keep', async () => {
  const deleted: string[] = []
  const ids = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6'
  ]
  const xml = `<?xml version="1.0"?>
<ListBucketResult>
${ids
  .map(
    (id, index) => `<Contents>
  <Key>saves/10/${id}.tar.gz</Key>
  <LastModified>2026-01-0${index + 1}T00:00:00.000Z</LastModified>
  <Size>${(index + 1) * 10}</Size>
</Contents>`
  )
  .join('\n')}
</ListBucketResult>`

  const client = {
    fetch: async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url
      const method = (
        init?.method || (typeof input === 'string' ? 'GET' : input.method)
      ).toUpperCase()
      if (method === 'GET' && url.includes('list-type=2')) {
        return new Response(xml, { status: 200 })
      }
      if (method === 'DELETE') {
        deleted.push(url)
        return new Response(null, { status: 204 })
      }
      return new Response('unexpected', { status: 500 })
    }
  } as unknown as AwsClient

  const kept = await retainArtifactsForAppid({
    client,
    endpoint,
    bucket: 'achieveme-saves',
    appid: '10',
    keep: 5
  })
  assert.equal(kept.length, 5)
  assert.equal(deleted.length, 1)
  assert.match(deleted[0], /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1\.tar\.gz/)
})
