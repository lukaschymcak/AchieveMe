import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { parseSearchResultsHtml, parseSteamTagIds } = await import(
  pathToFileURL(path.join(rootDir, '../src/shared/newsHtml.ts')).href
)

const FIXTURE = `
<a href="https://store.steampowered.com/app/123/" data-ds-appid="123" data-ds-tagids="[19, 21, 492]" class="search_result_row">
  <div class="search_capsule"><img src="https://cdn.example/capsule.jpg"></div>
  <div class="responsive_search_name_combined">
    <div class="search_name">
      <span class="title">Alpha Quest</span>
    </div>
    <div class="search_released">24 Mar, 2026</div>
  </div>
</a>
<a href="https://store.steampowered.com/app/456/" data-ds-tagids="122,9" data-ds-appid="456,789" class="search_result_row">
  <div class="search_capsule"><img data-src="https://cdn.example/other.jpg"></div>
  <div class="responsive_search_name_combined">
    <div class="search_name">
      <span class="title">Beta &amp; Friends</span>
    </div>
    <div class="search_released">Coming soon</div>
  </div>
</a>
<a href="https://store.steampowered.com/app/789/" data-ds-appid="789" class="search_result_row">
  <span class="title">No Tags</span>
  <div class="search_released">1 Jan, 2027</div>
</a>
<a href="https://store.steampowered.com/app/123/" data-ds-appid="123" class="search_result_row">
  <span class="title">Duplicate</span>
  <div class="search_released">1 Jan, 2027</div>
</a>
`

test('parseSteamTagIds supports bracket and csv forms', () => {
  assert.deepEqual(parseSteamTagIds('[19, 21, 492]'), [19, 21, 492])
  assert.deepEqual(parseSteamTagIds('122,9'), [122, 9])
  assert.deepEqual(parseSteamTagIds(''), [])
  assert.deepEqual(parseSteamTagIds('19,19,21'), [19, 21])
})

test('parseSearchResultsHtml extracts appid name label image and tagIds', () => {
  const items = parseSearchResultsHtml(FIXTURE)
  assert.equal(items.length, 3)
  assert.deepEqual(items[0], {
    appid: '123',
    name: 'Alpha Quest',
    releaseLabel: '24 Mar, 2026',
    headerImage: 'https://cdn.example/capsule.jpg',
    tagIds: [19, 21, 492]
  })
  assert.equal(items[1].appid, '456')
  assert.equal(items[1].name, 'Beta & Friends')
  assert.equal(items[1].releaseLabel, 'Coming soon')
  assert.equal(items[1].headerImage, 'https://cdn.example/other.jpg')
  assert.deepEqual(items[1].tagIds, [122, 9])
  assert.equal(items[2].appid, '789')
  assert.deepEqual(items[2].tagIds, [])
})

test('parseSearchResultsHtml returns empty for blank html', () => {
  assert.deepEqual(parseSearchResultsHtml(''), [])
  assert.deepEqual(parseSearchResultsHtml(null), [])
})
