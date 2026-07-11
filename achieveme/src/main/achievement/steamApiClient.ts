import type { Achievement, Game } from '../../shared/types'

export interface EnrichResult {
  game: Game
  achievements: Achievement[]
}

// STUB — implemented in PLAN-03
export async function enrichApp(
  _appid: string,
  _apiKey: string,
  _mergedRaw: Record<string, { achieved: boolean; unlockTime: number }>,
  _db: import('better-sqlite3').Database
): Promise<EnrichResult> {
  return {
    game: {
      appid: _appid,
      name: `Game ${_appid}`,
      cover_path: '',
      total_achievements: Object.keys(_mergedRaw).length,
      unlocked_achievements: Object.values(_mergedRaw).filter((a) => a.achieved).length,
      completion_pct: 0,
      has_platinum: 0,
      last_unlocked_at: 0,
      schema_fetched_at: 0
    },
    achievements: []
  }
}
