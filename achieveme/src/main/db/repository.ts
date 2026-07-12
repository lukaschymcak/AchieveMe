import type Database from 'better-sqlite3'
import type { Game, Achievement, SaveLocation } from '../../shared/types'

// ─── Games ───────────────────────────────────────────────────────────────────

export function upsertGame(db: Database.Database, game: Game): void {
  db.prepare(`
    INSERT INTO games (
      appid, name, total_achievements, unlocked_achievements,
      completion_pct, has_platinum, last_unlocked_at, schema_fetched_at
    )
    VALUES (
      @appid, @name, @total_achievements, @unlocked_achievements,
      @completion_pct, @has_platinum, @last_unlocked_at, @schema_fetched_at
    )
    ON CONFLICT(appid) DO UPDATE SET
      name                  = excluded.name,
      total_achievements    = excluded.total_achievements,
      unlocked_achievements = excluded.unlocked_achievements,
      completion_pct        = excluded.completion_pct,
      has_platinum          = excluded.has_platinum,
      last_unlocked_at      = excluded.last_unlocked_at,
      schema_fetched_at     = excluded.schema_fetched_at
  `).run(game)
}

export function getGame(db: Database.Database, appid: string): Game | undefined {
  return db
    .prepare(
      `SELECT appid, name, total_achievements, unlocked_achievements,
              completion_pct, has_platinum, last_unlocked_at, schema_fetched_at
       FROM games WHERE appid = ?`
    )
    .get(appid) as Game | undefined
}

export function getAllGames(db: Database.Database): Game[] {
  return db
    .prepare(
      `SELECT appid, name, total_achievements, unlocked_achievements,
              completion_pct, has_platinum, last_unlocked_at, schema_fetched_at
       FROM games ORDER BY completion_pct DESC`
    )
    .all() as Game[]
}

export function deleteGame(db: Database.Database, appid: string): void {
  db.prepare('DELETE FROM achievements WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM save_locations WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM api_cache WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM games WHERE appid = ?').run(appid)
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export function upsertAchievements(db: Database.Database, achievements: Achievement[]): void {
  const stmt = db.prepare(`
    INSERT INTO achievements (
      appid, api_name, display_name, description, icon_url,
      icon_gray_url, global_percent, earned, earned_time, trophy_tier, hidden
    )
    VALUES (
      @appid, @api_name, @display_name, @description, @icon_url,
      @icon_gray_url, @global_percent, @earned, @earned_time, @trophy_tier, @hidden
    )
    ON CONFLICT(appid, api_name) DO UPDATE SET
      display_name   = excluded.display_name,
      description    = excluded.description,
      icon_url       = excluded.icon_url,
      icon_gray_url  = excluded.icon_gray_url,
      global_percent = excluded.global_percent,
      earned         = excluded.earned,
      earned_time    = excluded.earned_time,
      trophy_tier    = excluded.trophy_tier,
      hidden         = excluded.hidden
  `)

  // Wrap in a transaction so all inserts happen in one disk write
  const insertMany = db.transaction((rows: Achievement[]) => {
    for (const row of rows) {
      stmt.run(row)
    }
  })

  insertMany(achievements)
}

export function getAchievementsForGame(db: Database.Database, appid: string): Achievement[] {
  return db
    .prepare('SELECT * FROM achievements WHERE appid = ? ORDER BY earned DESC, display_name ASC')
    .all(appid) as Achievement[]
}

export function getAllEarnedAchievements(db: Database.Database): Achievement[] {
  return db
    .prepare('SELECT * FROM achievements WHERE earned = 1')
    .all() as Achievement[]
}

// ─── API Cache ────────────────────────────────────────────────────────────────

export function getCacheEntry(
  db: Database.Database,
  appid: string,
  type: string
): { data_json: string; cached_at: number } | undefined {
  return db
    .prepare('SELECT data_json, cached_at FROM api_cache WHERE appid = ? AND type = ?')
    .get(appid, type) as { data_json: string; cached_at: number } | undefined
}

export function setCacheEntry(
  db: Database.Database,
  appid: string,
  type: string,
  data_json: string
): void {
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO api_cache (appid, type, data_json, cached_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(appid, type) DO UPDATE SET
      data_json = excluded.data_json,
      cached_at = excluded.cached_at
  `).run(appid, type, data_json, now)
}

// ─── Save Locations ───────────────────────────────────────────────────────────

export function upsertSaveLocation(db: Database.Database, row: SaveLocation): void {
  db.prepare(`
    INSERT INTO save_locations (
      appid, source, file_path, root_kind, root_source, custom_root, relative_path, updated_at
    )
    VALUES (
      @appid, @source, @file_path, @root_kind, @root_source, @custom_root, @relative_path, @updated_at
    )
    ON CONFLICT(appid, source, file_path) DO UPDATE SET
      root_kind     = excluded.root_kind,
      root_source   = excluded.root_source,
      custom_root   = excluded.custom_root,
      relative_path = excluded.relative_path,
      updated_at    = excluded.updated_at
  `).run(row)
}

export function getSaveLocationsForApp(db: Database.Database, appid: string): SaveLocation[] {
  return db
    .prepare('SELECT * FROM save_locations WHERE appid = ?')
    .all(appid) as SaveLocation[]
}

export function getAllSaveLocations(db: Database.Database): SaveLocation[] {
  return db.prepare('SELECT * FROM save_locations').all() as SaveLocation[]
}

export function deleteSaveLocationsForApp(db: Database.Database, appid: string): void {
  db.prepare('DELETE FROM save_locations WHERE appid = ?').run(appid)
}
