import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  downloadManifestZip,
  resetManifestZipDownloadInFlightForTests
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/manifestZipDownload.ts')).href
)

let tmpDir = ''

beforeEach(() => {
  resetManifestZipDownloadInFlightForTests()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-manifest-'))
})

afterEach(() => {
  resetManifestZipDownloadInFlightForTests()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/**
 * @param {Uint8Array} bytes
 * @param {{ delayMs?: number, status?: number }} [opts]
 */
function fakeFetchResponse(bytes, opts = {}) {
  const delayMs = opts.delayMs ?? 0
  const status = opts.status ?? 200
  let sent = false
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
            if (sent) return { done: true, value: undefined }
            sent = true
            return { done: false, value: bytes }
          }
        }
      }
    },
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-length' ? String(bytes.length) : null
      }
    },
    async json() {
      return { detail: 'nope' }
    }
  }
}

test('downloadManifestZip coalesces concurrent writes to the same zip', async () => {
  const dest = path.join(tmpDir, '3751260.zip')
  const payload = Buffer.from('PK-fake-zip-bytes')
  let fetches = 0
  const fetchFn = async () => {
    fetches += 1
    return fakeFetchResponse(payload, { delayMs: 40 })
  }

  const [a, b] = await Promise.all([
    downloadManifestZip({ url: 'https://example.test/3751260', destinationZipPath: dest, fetchFn }),
    downloadManifestZip({ url: 'https://example.test/3751260', destinationZipPath: dest, fetchFn })
  ])

  assert.equal(a, dest)
  assert.equal(b, dest)
  assert.equal(fetches, 1)
  assert.equal(fs.readFileSync(dest).equals(payload), true)
  const leftovers = fs.readdirSync(tmpDir).filter((name) => name.includes('.part'))
  assert.deepEqual(leftovers, [])
})

test('downloadManifestZip retries after a failed download', async () => {
  const dest = path.join(tmpDir, '570.zip')
  const payload = Buffer.from('ok-zip')
  let fetches = 0
  const fetchFn = async () => {
    fetches += 1
    if (fetches === 1) {
      return fakeFetchResponse(Buffer.from(''), { status: 500 })
    }
    return fakeFetchResponse(payload)
  }

  await assert.rejects(
    () => downloadManifestZip({ url: 'https://example.test/570', destinationZipPath: dest, fetchFn }),
    /API Error \(500\)/
  )
  const second = await downloadManifestZip({
    url: 'https://example.test/570',
    destinationZipPath: dest,
    fetchFn
  })

  assert.equal(second, dest)
  assert.equal(fetches, 2)
  assert.equal(fs.readFileSync(dest, 'utf8'), 'ok-zip')
})

test('downloadManifestZip coalesces before resolving headers', async () => {
  const dest = path.join(tmpDir, '3751260.zip')
  const payload = Buffer.from('zip')
  let fetches = 0
  let headerCalls = 0
  const fetchFn = async () => {
    fetches += 1
    return fakeFetchResponse(payload, { delayMs: 20 })
  }
  const resolveHeaders = async () => {
    headerCalls += 1
    await new Promise((r) => setTimeout(r, 30))
    return { Authorization: 'Bearer x' }
  }

  await Promise.all([
    downloadManifestZip({
      url: 'https://example.test/x',
      destinationZipPath: dest,
      fetchFn,
      resolveHeaders
    }),
    downloadManifestZip({
      url: 'https://example.test/x',
      destinationZipPath: dest,
      fetchFn,
      resolveHeaders
    })
  ])

  assert.equal(fetches, 1)
  assert.equal(headerCalls, 1)
})

test('downloadManifestZip does not coalesce different destinations', async () => {
  const aPath = path.join(tmpDir, '1.zip')
  const bPath = path.join(tmpDir, '2.zip')
  let fetches = 0
  const fetchFn = async () => {
    fetches += 1
    return fakeFetchResponse(Buffer.from(`zip-${fetches}`), { delayMs: 20 })
  }

  await Promise.all([
    downloadManifestZip({ url: 'https://example.test/1', destinationZipPath: aPath, fetchFn }),
    downloadManifestZip({ url: 'https://example.test/2', destinationZipPath: bPath, fetchFn })
  ])

  assert.equal(fetches, 2)
  assert.ok(fs.existsSync(aPath))
  assert.ok(fs.existsSync(bPath))
})
