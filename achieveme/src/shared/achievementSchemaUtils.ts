import type { Achievement, RawAchievement } from './types'

/** Steam GetSchemaForGame achievement entry used as the catalog source. */
export interface SteamSchemaAchievement {
  name: string
  displayName: string
  description?: string
  icon: string
  icongray: string
  hidden?: number
}

/**
 * Picks Steam schema: fresh TTL cache, then live result, then any stale cache.
 * `live` is `undefined` when a network fetch was not attempted.
 *
 * @param forceRefresh - When true, skip the fresh-TTL short-circuit.
 * @param freshCache - Schema within TTL, or null.
 * @param live - Live fetch result, or undefined if skipped.
 * @param staleCache - Any cached schema ignoring TTL, or null.
 */
export function resolveAchievementSchema(args: {
  forceRefresh: boolean
  freshCache: SteamSchemaAchievement[] | null
  live: SteamSchemaAchievement[] | null | undefined
  staleCache: SteamSchemaAchievement[] | null
}): SteamSchemaAchievement[] | null {
  const { forceRefresh, freshCache, live, staleCache } = args

  if (!forceRefresh && freshCache !== null) return freshCache

  if (live !== undefined) {
    if (live !== null) return live
    return staleCache
  }

  return staleCache
}

function getTrophyTier(globalPercent: number): 'gold' | 'silver' | 'bronze' {
  if (globalPercent < 20) return 'gold'
  if (globalPercent < 40) return 'silver'
  return 'bronze'
}

export type NormalizeIconUrl = (appid: string, value: string) => string

/**
 * Builds library achievement rows from Steam schema only.
 * Local save progress paints earned state; raw keys never define the catalog.
 *
 * @param appid - Steam AppID.
 * @param mergedRaw - Merged unlock progress from emulator saves.
 * @param schema - Steam schema list, or null when unavailable.
 * @param percentages - Global unlock percentages by API name.
 * @param normalizeIconUrl - Converts Steam icon hashes/URLs to CDN URLs.
 */
export function buildAchievementRecords(
  appid: string,
  mergedRaw: Record<string, RawAchievement>,
  schema: SteamSchemaAchievement[] | null,
  percentages: Record<string, number> | null,
  normalizeIconUrl: NormalizeIconUrl
): Achievement[] {
  const achievements: Achievement[] = []
  const schemaMap = new Map<string, SteamSchemaAchievement>()
  if (schema) {
    for (const entry of schema) schemaMap.set(entry.name, entry)
  }

  const apiNames = schema ? schema.map((entry) => entry.name) : []

  for (const apiName of apiNames) {
    const raw = mergedRaw[apiName]
    const earned = raw?.achieved ? 1 : 0
    const earnedTime = raw?.unlockTime ?? 0
    const maxProgress = raw?.maxProgress ?? 0
    const progress = maxProgress > 0 ? (raw?.progress ?? 0) : 0

    const schemaEntry = schemaMap.get(apiName)
    const globalPercent = percentages?.[apiName] ?? 0
    const tier = getTrophyTier(globalPercent)

    const colorIconUrl = normalizeIconUrl(appid, schemaEntry?.icon ?? '')
    const grayIconUrl = normalizeIconUrl(appid, schemaEntry?.icongray ?? '') || colorIconUrl

    achievements.push({
      appid,
      api_name: apiName,
      display_name: schemaEntry?.displayName ?? apiName,
      description: schemaEntry?.description ?? '',
      icon_url: earned ? colorIconUrl : '',
      icon_gray_url: grayIconUrl,
      global_percent: globalPercent,
      earned,
      earned_time: earnedTime,
      trophy_tier: tier,
      hidden: schemaEntry?.hidden === 1 ? 1 : 0,
      progress,
      max_progress: maxProgress
    })
  }

  return achievements
}

/**
 * Interprets a successful GetSchemaForGame JSON body into a catalog list.
 * Missing achievements under a present `game` object means an empty catalog
 * (stats not published yet), not a failed fetch.
 *
 * @param parsed - Parsed Steam schema JSON.
 */
export function schemaListFromSteamResponse(parsed: {
  game?: {
    availableGameStats?: {
      achievements?: SteamSchemaAchievement[]
    }
  }
}): SteamSchemaAchievement[] | null {
  const rawList = parsed?.game?.availableGameStats?.achievements
  if (Array.isArray(rawList)) return rawList
  if (parsed?.game !== undefined) return []
  return null
}

/**
 * Converts CODEX/RUNE INI sections into unlock progress.
 * Only sections with an `UnlockTime` key are included.
 *
 * @param sections - INI section name → key/value map (keys already lowercased).
 */
export function rawAchievementsFromIniSections(
  sections: Iterable<[string, Map<string, string>]>
): Record<string, RawAchievement> {
  const result: Record<string, RawAchievement> = {}

  for (const [apiName, keys] of sections) {
    const unlockRaw = keys.get('unlocktime')
    if (unlockRaw === undefined) continue

    const unlockTime = parseInt(unlockRaw, 10) || 0
    result[apiName] = {
      achieved: unlockTime > 0,
      unlockTime
    }
  }

  return result
}
