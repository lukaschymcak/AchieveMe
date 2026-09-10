import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { truncateCloudLogText } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/cloudSavesDebugLog.ts')).href
)

test('truncateCloudLogText collapses whitespace and caps length', () => {
  assert.equal(truncateCloudLogText('  a\n\nb  '), 'a b')
  const long = 'x'.repeat(900)
  const out = truncateCloudLogText(long, 100)
  assert.ok(out.startsWith('x'.repeat(100)))
  assert.match(out, /\(\+800\)$/)
})
