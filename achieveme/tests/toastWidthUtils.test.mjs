import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  TOAST_HEIGHT,
  TOAST_MAX_WIDTH,
  TOAST_MIN_WIDTH,
  TOAST_PANEL_MAX,
  TOAST_PANEL_MIN,
  TOAST_ROOT_PAD_X,
  clampToastPanelWidth,
  clampToastWindowWidth,
  toastWindowWidthFromCard
} = await import(pathToFileURL(path.join(rootDir, '../src/shared/toastWidthUtils.ts')).href)

test('toast size constants', () => {
  assert.equal(TOAST_HEIGHT, 180)
  assert.equal(TOAST_ROOT_PAD_X, 40)
  assert.equal(TOAST_MIN_WIDTH, TOAST_PANEL_MIN + TOAST_ROOT_PAD_X)
  assert.equal(TOAST_MAX_WIDTH, TOAST_PANEL_MAX + TOAST_ROOT_PAD_X)
  assert.ok(TOAST_PANEL_MIN < TOAST_PANEL_MAX)
})

test('clampToastPanelWidth clamps and ceils', () => {
  assert.equal(clampToastPanelWidth(TOAST_PANEL_MIN - 50), TOAST_PANEL_MIN)
  assert.equal(clampToastPanelWidth(TOAST_PANEL_MAX + 50), TOAST_PANEL_MAX)
  assert.equal(clampToastPanelWidth(400.2), 401)
  assert.equal(clampToastPanelWidth(Number.NaN), TOAST_PANEL_MIN)
})

test('clampToastWindowWidth clamps and ceils', () => {
  assert.equal(clampToastWindowWidth(TOAST_MIN_WIDTH - 50), TOAST_MIN_WIDTH)
  assert.equal(clampToastWindowWidth(TOAST_MAX_WIDTH + 50), TOAST_MAX_WIDTH)
  assert.equal(clampToastWindowWidth(Number.NaN), TOAST_MIN_WIDTH)
})

test('toastWindowWidthFromCard adds root pad then clamps', () => {
  assert.equal(toastWindowWidthFromCard(400), 440)
  assert.equal(toastWindowWidthFromCard(TOAST_PANEL_MAX), TOAST_MAX_WIDTH)
})
