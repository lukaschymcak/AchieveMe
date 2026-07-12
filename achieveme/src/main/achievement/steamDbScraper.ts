import { BrowserWindow } from 'electron'
import { load } from 'cheerio'
import type Database from 'better-sqlite3'
import type { Achievement } from '../../shared/types'
import { getCacheEntry, setCacheEntry } from '../db/repository'
import { isFresh } from './cacheUtils'

const STEAMDB_TTL = 604800
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36'

export interface SteamDbAchievementRow {
  apiName: string
  nameEN: string
  descEN: string
  hidden: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeText(value: string | undefined | null): string {
  return (value || '').replace(/\u00A0/g, ' ').trim()
}

/** SteamDB prefixes hidden descriptions with "Hidden achievement:" */
function normalizeHidden(descEN: string): { hidden: number; clean: string } {
  if (!descEN) return { hidden: 0, clean: '' }

  let s = String(descEN)
    .replace(/\u00A0/g, ' ')
    .trim()
  let hidden = 0

  if (/^\s*Hidden achievement:/i.test(s)) {
    hidden = 1
    s = s.replace(/^\s*Hidden achievement:\s*/i, '').trim()
  } else if (/^\s*This achievement is hidden\.\s*/i.test(s)) {
    hidden = 1
    s = s.replace(/^\s*This achievement is hidden\.\s*/i, '').trim()
  }

  return { hidden, clean: s }
}

function normalizeMatchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function extractSteamDbFromHtml(html: string): SteamDbAchievementRow[] {
  const $ = load(html || '')
  const rows: SteamDbAchievementRow[] = []
  const seen = new Set<string>()

  $('[id^="achievement-"]').each((_, el) => {
    const $el = $(el)
    const id = String($el.attr('id') || '')
    if (!id.startsWith('achievement-')) return

    const apiName =
      safeText(
        $el
          .find(
            'div.achievement_inner > div > div.achievement_right > div.achievement_api'
          )
          .first()
          .text()
      ) || id.replace(/^achievement-/, '')

    const nameEN = safeText(
      $el
        .find('div.achievement_inner > div > div:nth-child(1) > div.achievement_name')
        .first()
        .text()
    )
    const descEN0 = safeText(
      $el
        .find('div.achievement_inner > div > div:nth-child(1) > div.achievement_desc')
        .first()
        .text()
    )
    const { hidden, clean: descEN } = normalizeHidden(descEN0)

    const key = apiName || nameEN
    if (!key || seen.has(key)) return
    seen.add(key)

    rows.push({ apiName, nameEN, descEN, hidden })
  })

  return rows
}

async function scrapeSteamDbHtml(appid: string): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1000,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.setUserAgent(USER_AGENT)

  try {
    const url = `https://steamdb.info/app/${appid}/stats/`
    await win.loadURL(url, { userAgent: USER_AGENT })

    let found = false
    for (let i = 0; i < 60; i++) {
      const count = (await win.webContents.executeJavaScript(
        'document.querySelectorAll(\'[id^="achievement-"]\').length'
      )) as number
      if (count > 0) {
        found = true
        break
      }
      await sleep(500)
    }
    if (!found) throw new Error('No achievements found on SteamDB')

    await win.webContents.executeJavaScript(`
      (async () => {
        const items = document.querySelectorAll('[id^="achievement-"]');
        for (const el of items) {
          el.scrollIntoView({ block: 'center' });
          await new Promise((r) => setTimeout(r, 12));
        }
      })()
    `)
    await sleep(200)

    return (await win.webContents.executeJavaScript(
      'document.documentElement.outerHTML'
    )) as string
  } finally {
    win.destroy()
  }
}

export async function fetchSteamDbAchievements(
  db: Database.Database,
  appid: string,
  forceRefresh = false
): Promise<SteamDbAchievementRow[]> {
  if (!forceRefresh) {
    const row = getCacheEntry(db, appid, 'steamdb')
    if (row && isFresh(row.cached_at, STEAMDB_TTL)) {
      try {
        return JSON.parse(row.data_json) as SteamDbAchievementRow[]
      } catch {
        // stale cache entry
      }
    }
  }

  try {
    const html = await scrapeSteamDbHtml(appid)
    const rows = extractSteamDbFromHtml(html)
    if (rows.length) {
      setCacheEntry(db, appid, 'steamdb', JSON.stringify(rows))
    }
    return rows
  } catch {
    return []
  }
}

export function mergeSteamDbHiddenDescriptions(
  achievements: Achievement[],
  steamDbRows: SteamDbAchievementRow[]
): void {
  if (!steamDbRows.length) return

  const byApiName = new Map<string, SteamDbAchievementRow>()
  const byTitle = new Map<string, SteamDbAchievementRow>()

  for (const row of steamDbRows) {
    if (row.apiName) byApiName.set(row.apiName, row)
    const titleKey = normalizeMatchText(row.nameEN)
    if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, row)
  }

  for (const ach of achievements) {
    if (ach.hidden !== 1 || ach.description.trim()) continue

    const row =
      byApiName.get(ach.api_name) ?? byTitle.get(normalizeMatchText(ach.display_name))
    if (row?.descEN) {
      ach.description = row.descEN
    }
  }
}

/** Fetch SteamDB data if needed and fill hidden descriptions. Returns true if any changed. */
export async function ensureSteamDbHiddenDescriptions(
  db: Database.Database,
  appid: string,
  achievements: Achievement[],
  forceRefresh = false
): Promise<boolean> {
  const needsSteamDb = achievements.some((a) => a.hidden === 1 && !a.description.trim())
  if (!needsSteamDb) return false

  const before = achievements.map((a) => a.description)
  const steamDbRows = await fetchSteamDbAchievements(db, appid, forceRefresh)
  mergeSteamDbHiddenDescriptions(achievements, steamDbRows)
  return achievements.some((a, i) => a.description !== before[i])
}
