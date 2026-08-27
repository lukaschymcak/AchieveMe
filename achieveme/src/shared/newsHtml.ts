/**
 * Parses Steam store search `results_html` fragments into release rows.
 * Pure string parsing — no cheerio (shared is included in the renderer tsconfig).
 */

/** One game row extracted from Steam search HTML. */
export interface ParsedSearchRelease {
  appid: string
  name: string
  releaseLabel: string
  headerImage: string
  /** Steam store tag IDs from `data-ds-tagids` (empty when missing). */
  tagIds: number[]
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
}

function stripTags(value: string): string {
  return decodeBasicEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Parses `data-ds-tagids` values like `[19, 21]` or `19,21` into unique numbers.
 *
 * @param raw - Attribute value, or empty.
 */
export function parseSteamTagIds(raw: string): number[] {
  const source = String(raw || '').trim()
  if (!source) return []

  const seen = new Set<number>()
  const out: number[] = []
  const matches = source.match(/\d+/g) || []
  for (const token of matches) {
    const id = Number(token)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function tagIdsFromOpeningAttrs(attrs: string): number[] {
  const match = attrs.match(/\bdata-ds-tagids=["']([^"']*)["']/i)
  if (!match) return []
  return parseSteamTagIds(match[1] || '')
}

/**
 * Parses Steam infinite-search `results_html` into release items.
 *
 * @param html - HTML fragment from store search JSON `results_html`.
 */
export function parseSearchResultsHtml(html: string): ParsedSearchRelease[] {
  const source = String(html || '')
  if (!source) return []

  const items: ParsedSearchRelease[] = []
  const seen = new Set<string>()

  // Capture full opening attrs so we can read both data-ds-appid and data-ds-tagids.
  const rowRe =
    /<a\b([^>]*\bdata-ds-appid=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null
  while ((match = rowRe.exec(source)) !== null) {
    const attrs = match[1] || ''
    const rawId = String(match[2] || '').trim()
    const appid = rawId.split(',')[0]?.trim() || ''
    if (!appid || seen.has(appid)) continue

    const body = match[3] || ''

    const titleMatch = body.match(/class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const name = titleMatch ? stripTags(titleMatch[1]) : ''
    if (!name) continue

    const releasedMatch = body.match(
      /class=["'][^"']*\bsearch_released\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    )
    const releaseLabel = releasedMatch ? stripTags(releasedMatch[1]) : ''

    const imgMatch =
      body.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) ||
      body.match(/<img\b[^>]*\bdata-src=["']([^"']+)["']/i)
    const headerImage = imgMatch ? decodeBasicEntities(imgMatch[1].trim()) : ''
    const tagIds = tagIdsFromOpeningAttrs(attrs)

    seen.add(appid)
    items.push({ appid, name, releaseLabel, headerImage, tagIds })
  }

  return items
}
