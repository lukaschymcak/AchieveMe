import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  TOAST_HEIGHT,
  TOAST_MAX_WIDTH,
  TOAST_MIN_WIDTH,
  TOAST_ROOT_PAD_X,
  clampToastWindowWidth,
  toastWindowWidthFromCard
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/toastWidthUtils.ts')).href)

test('toast height and pad constants', () => {
  assert.equal(TOAST_HEIGHT, 120)
  assert.equal(TOAST_ROOT_PAD_X, 20)
  assert.ok(TOAST_MIN_WIDTH < TOAST_MAX_WIDTH)
})

test('clampToastWindowWidth clamps and ceils', () => {
  assert.equal(clampToastWindowWidth(TOAST_MIN_WIDTH - 50), TOAST_MIN_WIDTH)
  assert.equal(clampToastWindowWidth(TOAST_MAX_WIDTH + 50), TOAST_MAX_WIDTH)
  assert.equal(clampToastWindowWidth(400.2), 401)
  assert.equal(clampToastWindowWidth(Number.NaN), TOAST_MIN_WIDTH)
})

test('toastWindowWidthFromCard adds root pad then clamps', () => {
  assert.equal(toastWindowWidthFromCard(400), 420)
  assert.equal(toastWindowWidthFromCard(TOAST_MAX_WIDTH), TOAST_MAX_WIDTH)
})
