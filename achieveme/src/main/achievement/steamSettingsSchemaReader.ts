import fs from 'node:fs'
import path from 'node:path'
import type { SteamSchemaAchievement } from '../../shared/achievementSchemaUtils.ts'

/** Same filename rule as the `achieveme-img://` icon protocol. */
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/

interface GoldbergAchievementEntry {
  name?: unknown
  displayName?: unknown
  description?: unknown
  hidden?: unknown
  icon?: unknown
  icon_gray?: unknown
  icongray?: unknown
}

export interface SteamSettingsSchemaResult {
  schema: SteamSchemaAchievement[]
  /** Icon basename → absolute file under `steam_settings/`. */
  iconSources: Map<string, string>
}

/**
 * Reads Goldberg `steam_settings/achievements.json` beside the Steam API DLL.
 * Icon fields become bare filenames so the existing schema pipeline can cache them.
 * Returns null when the file is missing, unreadable, or has no named achievements.
 *
 * @param dllDir - Directory containing `steam_api.dll` or `steam_api64.dll`.
 */
export function readSteamSettingsSchema(dllDir: string): SteamSettingsSchemaResult | null {
  const root = String(dllDir ?? '').trim()
  if (!root) return null

  const settingsDir = path.join(root, 'steam_settings')
  const schemaPath = path.join(settingsDir, 'achievements.json')
  if (!fs.existsSync(schemaPath)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as unknown
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null

  const schema: SteamSchemaAchievement[] = []
  const iconSources = new Map<string, string>()

  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as GoldbergAchievementEntry
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) continue

    const displayName = extractLocalizedString(entry.displayName, name) || name
    const description = extractLocalizedString(entry.description, '')

    schema.push({
      name,
      displayName,
      description,
      icon: localIconFilename(settingsDir, entry.icon, iconSources),
      icongray: localIconFilename(
        settingsDir,
        entry.icon_gray ?? entry.icongray,
        iconSources
      ),
      hidden: isHiddenFlag(entry.hidden) ? 1 : 0
    })
  }

  if (schema.length === 0) return null
  return { schema, iconSources }
}

function isHiddenFlag(value: unknown): boolean {
  return value === 1 || value === '1'
}

/**
 * Goldberg stores display names and descriptions as either a plain string or a
 * language map such as `{ "english": "Resignation" }`. Prefer English, then the
 * first string value, then the fallback.
 */
function extractLocalizedString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.english === 'string') return obj.english.trim()
    const first = Object.values(obj).find((v): v is string => typeof v === 'string')
    if (first !== undefined) return first.trim()
  }
  return fallback
}

/**
 * Maps a Goldberg relative icon path to a protocol-safe basename and records
 * the absolute source file. Paths that leave `steam_settings/` are ignored.
 */
function localIconFilename(
  settingsDir: string,
  relativePath: unknown,
  iconSources: Map<string, string>
): string {
  if (typeof relativePath !== 'string') return ''
  const trimmed = relativePath.trim()
  if (!trimmed || trimmed.includes('..')) return ''

  const filename = path.basename(trimmed)
  if (!SAFE_FILENAME_RE.test(filename)) return ''

  const root = path.resolve(settingsDir)
  const absolute = path.resolve(settingsDir, trimmed)
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  const absoluteKey = absolute.toLowerCase()
  const rootKey = root.toLowerCase()
  if (absoluteKey !== rootKey && !absoluteKey.startsWith(rootPrefix.toLowerCase())) {
    return ''
  }

  iconSources.set(filename, absolute)
  return filename
}
