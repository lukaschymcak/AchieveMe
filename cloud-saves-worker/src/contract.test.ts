import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertBearerAuth } from './auth.ts'
import {
  MAX_ARTIFACT_BYTES,
  artifactObjectKey,
  assertAppid,
  assertArtifactId,
  assertBytes,
  assertSha256,
  ContractError,
  parsePrepareBody
} from './contract.ts'
import { handleRequest, type WorkerEnv } from './index.ts'

const env: WorkerEnv = {
  API_TOKEN: 'secret-token',
  R2_ACCOUNT_ID: 'e692a40bf42b6ba9418249700af7a1b1',
  R2_ACCESS_KEY_ID: 'akid',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'achieveme-saves'
}

const validSha =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

test('assertBearerAuth rejects missing Authorization', () => {
  assert.throws(
    () => assertBearerAuth(new Request('http://localhost/v1/artifacts'), 'secret-token'),
    (error: unknown) => error instanceof ContractError && error.status === 401
  )
})

test('assertBearerAuth rejects wrong token', () => {
  assert.throws(
    () =>
      assertBearerAuth(
        new Request('http://localhost/v1/artifacts', {
          headers: { Authorization: 'Bearer wrong' }
        }),
        'secret-token'
      ),
    (error: unknown) => error instanceof ContractError && error.status === 401
  )
})

test('assertBearerAuth accepts matching Bearer token', () => {
  assert.doesNotThrow(() =>
    assertBearerAuth(
      new Request('http://localhost/v1/artifacts', {
        headers: { Authorization: 'Bearer secret-token' }
      }),
      'secret-token'
    )
  )
})

test('assertAppid rejects path traversal and non-numeric values', () => {
  assert.throws(() => assertAppid('../../x'), (e: unknown) => e instanceof ContractError)
  assert.throws(() => assertAppid('2379780/foo'), (e: unknown) => e instanceof ContractError)
  assert.throws(() => assertAppid('abc'), (e: unknown) => e instanceof ContractError)
  assert.equal(assertAppid('2379780'), '2379780')
})

test('assertBytes rejects oversize and non-positive values', () => {
  assert.throws(() => assertBytes(0), (e: unknown) => e instanceof ContractError)
  assert.throws(
    () => assertBytes(MAX_ARTIFACT_BYTES + 1),
    (e: unknown) => e instanceof ContractError
  )
  assert.equal(assertBytes(12), 12)
})

test('assertSha256 rejects non-hex digests', () => {
  assert.throws(() => assertSha256('zz'), (e: unknown) => e instanceof ContractError)
  assert.throws(() => assertSha256('abcd'), (e: unknown) => e instanceof ContractError)
  assert.equal(assertSha256(validSha), validSha)
})

test('assertArtifactId rejects path segments', () => {
  assert.throws(() => assertArtifactId('../x'), (e: unknown) => e instanceof ContractError)
  assert.throws(
    () => assertArtifactId('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    (e: unknown) => e instanceof ContractError
  )
  assert.equal(
    assertArtifactId('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )
})

test('artifactObjectKey builds saves/{appid}/{id}.tar.gz', () => {
  assert.equal(
    artifactObjectKey('10', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    'saves/10/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.tar.gz'
  )
})

test('parsePrepareBody validates fields', () => {
  assert.throws(
    () => parsePrepareBody({ appid: '10', bytes: MAX_ARTIFACT_BYTES + 1, sha256: validSha }),
    (e: unknown) => e instanceof ContractError && e.status === 400
  )
  const ok = parsePrepareBody({ appid: '10', bytes: 100, sha256: validSha })
  assert.deepEqual(ok, { appid: '10', bytes: 100, sha256: validSha })
})

test('handleRequest returns 401 without Authorization', async () => {
  const response = await handleRequest(
    new Request('http://localhost/v1/artifacts', {
      method: 'POST',
      body: JSON.stringify({ appid: '10', bytes: 1, sha256: validSha })
    }),
    env
  )
  assert.equal(response.status, 401)
})

test('handleRequest returns 401 with wrong token', async () => {
  const response = await handleRequest(
    new Request('http://localhost/v1/artifacts', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope', 'content-type': 'application/json' },
      body: JSON.stringify({ appid: '10', bytes: 1, sha256: validSha })
    }),
    env
  )
  assert.equal(response.status, 401)
})

test('handleRequest returns 400 for invalid appid', async () => {
  const response = await handleRequest(
    new Request('http://localhost/v1/artifacts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ appid: '../../x', bytes: 1, sha256: validSha })
    }),
    env
  )
  assert.equal(response.status, 400)
})

test('handleRequest returns 400 for oversize bytes', async () => {
  const response = await handleRequest(
    new Request('http://localhost/v1/artifacts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        appid: '10',
        bytes: MAX_ARTIFACT_BYTES + 1,
        sha256: validSha
      })
    }),
    env
  )
  assert.equal(response.status, 400)
})

test('assertUploadedSizeMatches rejects mismatch', async () => {
  const { assertUploadedSizeMatches, ContractError } = await import('./contract.ts')
  assert.throws(
    () => assertUploadedSizeMatches(10, 11),
    (e: unknown) => e instanceof ContractError && e.status === 409
  )
  assert.doesNotThrow(() => assertUploadedSizeMatches(10, 10))
})
