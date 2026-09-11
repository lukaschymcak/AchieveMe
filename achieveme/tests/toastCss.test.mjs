import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/toast/toast.css'),
  'utf8'
)

test('toast panel uses a rarity drop-shadow border glow', () => {
  const panel = css.slice(css.indexOf('.unlock-toast__panel {'), css.indexOf('/* Hidden until --play'))
  assert.match(panel, /drop-shadow\(0 0 0\.6px color-mix\(in oklch, var\(--toast-accent\)/)
  assert.match(panel, /drop-shadow\(0 0 6px color-mix\(in oklch, var\(--toast-accent\)/)
  assert.match(panel, /0 0 0 1px color-mix\(in oklch, var\(--toast-accent\)/)
})

test('gold and platinum toasts keep a slightly stronger glow', () => {
  assert.match(css, /\[data-tier='gold'\] \.unlock-toast__panel[\s\S]*drop-shadow\(0 0 8px/)
  assert.match(css, /\[data-tier='platinum'\] \.unlock-toast__panel[\s\S]*drop-shadow\(0 0 8px/)
})
