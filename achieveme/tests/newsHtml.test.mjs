import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { parseSearchResultsHtml } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/newsHtml.ts')).href
)

const FIXTURE = `
<a href="https://store.steampowered.com/app/123/" data-ds-appid="123" class="search_result_row">
  <div class="search_capsule"><img src="https://cdn.example/capsule.jpg"></div>
  <div class="responsive_search_name_combined">
    <div class="search_name">
      <span class="title">Alpha Quest</span>
    </div>
    <div class="search_released">24 Mar, 2026</div>
  </div>
</a>
<a href="https://store.steampowered.com/app/456/" data-ds-appid="456,789" class="search_result_row">
  <div class="search_capsule"><img data-src="https://cdn.example/other.jpg"></div>
  <div class="responsive_search_name_combined">
    <div class="search_name">
      <span class="title">Beta &amp; Friends</span>
    </div>
    <div class="search_released">Coming soon</div>
  </div>
</a>
<a href="https://store.steampowered.com/app/123/" data-ds-appid="123" class="search_result_row">
  <span class="title">Duplicate</span>
  <div class="search_released">1 Jan, 2027</div>
</a>
`

test('parseSearchResultsHtml extracts appid name label and image', () => {
  const items = parseSearchResultsHtml(FIXTURE)
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], {
    appid: '123',
    name: 'Alpha Quest',
    releaseLabel: '24 Mar, 2026',
    headerImage: 'https://cdn.example/capsule.jpg'
  })
  assert.equal(items[1].appid, '456')
  assert.equal(items[1].name, 'Beta & Friends')
  assert.equal(items[1].releaseLabel, 'Coming soon')
  assert.equal(items[1].headerImage, 'https://cdn.example/other.jpg')
})

test('parseSearchResultsHtml returns empty for blank html', () => {
  assert.deepEqual(parseSearchResultsHtml(''), [])
  assert.deepEqual(parseSearchResultsHtml(null), [])
})
