import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/index.css'),
  'utf8'
)

test('defines a success token next to error', () => {
  assert.match(css, /--color-success:\s*oklch\(74% 0\.14 155\)/)
  assert.match(css, /\.settings-page__status--success\s*\{[^}]*var\(--color-success\)/)
  assert.match(css, /\.settings-page__chrome-status\s*\{[^}]*overflow-wrap:\s*anywhere/)
})

test('styles action chips with progress tint, not action-blue fill', () => {
  const actionBlock = css.match(/\.app-chip--action,\s*\.library-chip--action \{([^}]+)\}/)
  assert.ok(actionBlock, 'missing .library-chip--action rule')
  assert.match(actionBlock[1], /color:\s*var\(--ink\)/)
  assert.match(actionBlock[1], /--color-progress/)
  assert.doesNotMatch(actionBlock[1], /var\(--color-action\)/)
})

test('settings checkbox wrap and slider use action-blue focus rings', () => {
  assert.match(css, /\.settings-row__checkbox-wrap:has\(:focus-visible\)/)
  assert.match(css, /\.settings-row__slider:focus-visible/)
})

test('settings list does not clip search focus rings', () => {
  const listBlock = css.match(/\.settings-page__list \{([^}]+)\}/)
  assert.ok(listBlock, 'missing .settings-page__list rule')
  assert.match(listBlock[1], /overflow:\s*visible/)
  assert.doesNotMatch(listBlock[1], /overflow:\s*hidden/)
  assert.match(css, /\.settings-row:first-child \{[^}]*border-start-start-radius:\s*var\(--radius-md\)/)
  assert.match(css, /\.settings-row:last-child \{[^}]*border-end-start-radius:\s*var\(--radius-md\)/)
})

test('sticky Settings chrome pins over the black canvas', () => {
  const stickyBlock = css.match(
    /\.app-chrome-wrap--sticky,\s*\.library-chrome-wrap--sticky \{([^}]+)\}/
  )
  assert.ok(stickyBlock, 'missing .app-chrome-wrap--sticky rule')
  assert.match(stickyBlock[1], /position:\s*sticky/)
  assert.match(stickyBlock[1], /top:\s*0/)
  assert.match(stickyBlock[1], /z-index:\s*80/)
  assert.match(stickyBlock[1], /background:\s*oklch\(0% 0 0\)/)
})
