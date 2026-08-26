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
 * Parses Steam infinite-search `results_html` into release items.
 *
 * @param html - HTML fragment from store search JSON `results_html`.
 */
export function parseSearchResultsHtml(html: string): ParsedSearchRelease[] {
  const source = String(html || '')
  if (!source) return []

  const items: ParsedSearchRelease[] = []
  const seen = new Set<string>()

  // Each result is typically an <a class="search_result_row" data-ds-appid="...">...</a>
  const rowRe =
    /<a\b[^>]*\bdata-ds-appid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null
  while ((match = rowRe.exec(source)) !== null) {
    const rawId = String(match[1] || '').trim()
    const appid = rawId.split(',')[0]?.trim() || ''
    if (!appid || seen.has(appid)) continue

    const body = match[2] || ''

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

    seen.add(appid)
    items.push({ appid, name, releaseLabel, headerImage })
  }

  return items
}
