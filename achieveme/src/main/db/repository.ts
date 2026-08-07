import type Database from 'better-sqlite3'
import type { Game, Achievement, SaveLocation, UpdateStatus } from '../../shared/types'

const GAME_COLUMNS =
  'appid, name, total_achievements, unlocked_achievements, completion_pct, has_platinum, last_unlocked_at, schema_fetched_at, playtime_seconds, install_path, launch_exe, manifest_gids, update_status'

function normalizeGameRow(row: Game | undefined): Game | undefined {
  if (!row) return undefined
  return {
    ...row,
    playtime_seconds: row.playtime_seconds ?? 0,
    install_path: row.install_path ?? '',
    launch_exe: row.launch_exe ?? '',
    manifest_gids: row.manifest_gids ?? '',
    update_status: (row.update_status ?? '') as UpdateStatus
  }
}

// ─── Games ───────────────────────────────────────────────────────────────────

export function upsertGame(db: Database.Database, game: Game): void {
  const existing = getGame(db, game.appid)
  const playtimeSeconds = game.playtime_seconds ?? existing?.playtime_seconds ?? 0
  const installPath = game.install_path ?? existing?.install_path ?? ''
  const launchExe = game.launch_exe ?? existing?.launch_exe ?? ''
  const manifestGids = game.manifest_gids ?? existing?.manifest_gids ?? ''
  const updateStatus = game.update_status ?? existing?.update_status ?? ''

  db.prepare(`
    INSERT INTO games (
      appid, name, total_achievements, unlocked_achievements,
      completion_pct, has_platinum, last_unlocked_at, schema_fetched_at,
      playtime_seconds, install_path, launch_exe, manifest_gids, update_status
    )
    VALUES (
      @appid, @name, @total_achievements, @unlocked_achievements,
      @completion_pct, @has_platinum, @last_unlocked_at, @schema_fetched_at,
      @playtime_seconds, @install_path, @launch_exe, @manifest_gids, @update_status
    )
    ON CONFLICT(appid) DO UPDATE SET
      name                  = excluded.name,
      total_achievements    = excluded.total_achievements,
      unlocked_achievements = excluded.unlocked_achievements,
      completion_pct        = excluded.completion_pct,
      has_platinum          = excluded.has_platinum,
      last_unlocked_at      = excluded.last_unlocked_at,
      schema_fetched_at     = excluded.schema_fetched_at,
      playtime_seconds      = CASE
        WHEN excluded.playtime_seconds > games.playtime_seconds
          THEN excluded.playtime_seconds
        ELSE games.playtime_seconds
      END,
      install_path          = CASE
        WHEN excluded.install_path != '' THEN excluded.install_path
        ELSE games.install_path
      END,
      launch_exe            = CASE
        WHEN excluded.launch_exe != '' THEN excluded.launch_exe
        ELSE games.launch_exe
      END,
      manifest_gids         = CASE
        WHEN excluded.manifest_gids != '' THEN excluded.manifest_gids
        ELSE games.manifest_gids
      END,
      update_status         = CASE
        WHEN excluded.update_status != '' THEN excluded.update_status
        ELSE games.update_status
      END
  `).run({
    ...game,
    playtime_seconds: playtimeSeconds,
    install_path: installPath,
    launch_exe: launchExe,
    manifest_gids: manifestGids,
    update_status: updateStatus
  })
}

export function getGame(db: Database.Database, appid: string): Game | undefined {
  const row = db.prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE appid = ?`).get(appid) as
    | Game
    | undefined
  return normalizeGameRow(row)
}

export function getAllGames(db: Database.Database): Game[] {
  const rows = db
    .prepare(`SELECT ${GAME_COLUMNS} FROM games ORDER BY completion_pct DESC`)
    .all() as Game[]
  return rows.map((row) => normalizeGameRow(row)!)
}

/**
 * Returns games that have a stored manifest GID baseline for update checks.
 *
 * @param db - Open SQLite database.
 */
export function getAllGamesWithGids(db: Database.Database): Game[] {
  const rows = db
    .prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE manifest_gids != '' ORDER BY name ASC`)
    .all() as Game[]
  return rows.map((row) => normalizeGameRow(row)!)
}

/**
 * Persists depot → GID baseline JSON and marks the game up to date.
 * Creates a stub game row when the app is not yet in the library.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param gids - Depot → manifest GID map.
 * @param gameName - Optional display name for stub insert.
 */
export function saveManifestGids(
  db: Database.Database,
  appid: string,
  gids: Record<string, string>,
  gameName?: string,
  installPath?: string
): void {
  const cleanAppid = String(appid || '').trim()
  if (!cleanAppid) throw new Error('Invalid AppID for manifest GIDs.')
  const json = JSON.stringify(gids || {})
  const name = String(gameName || '').trim() || `App ${cleanAppid}`
  const iPath = String(installPath || '').trim()

  db.prepare(`
    INSERT INTO games (appid, name, manifest_gids, update_status, install_path)
    VALUES (?, ?, ?, 'up_to_date', ?)
    ON CONFLICT(appid) DO UPDATE SET
      manifest_gids = excluded.manifest_gids,
      update_status = 'up_to_date',
      name = CASE
        WHEN games.name = '' OR games.name LIKE 'App %' THEN excluded.name
        ELSE games.name
      END,
      install_path = CASE
        WHEN games.install_path = '' AND excluded.install_path != '' THEN excluded.install_path
        ELSE games.install_path
      END
  `).run(cleanAppid, name, json, iPath)
}

/**
 * Persists the last known Steam update status for a game.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param status - Update status to store.
 */
export function saveUpdateStatus(db: Database.Database, appid: string, status: UpdateStatus): void {
  db.prepare('UPDATE games SET update_status = ? WHERE appid = ?').run(status, appid)
}

export function updateGamePlaytime(db: Database.Database, appid: string, seconds: number): void {
  db.prepare('UPDATE games SET playtime_seconds = ? WHERE appid = ?').run(seconds, appid)
}

export function updateGameInstallPath(db: Database.Database, appid: string, installPath: string): void {
  db.prepare('UPDATE games SET install_path = ? WHERE appid = ?').run(installPath, appid)
}

/**
 * Persists the absolute path of the executable used by Play.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param launchExe - Absolute path to the game `.exe`, or empty to clear.
 */
export function updateGameLaunchExe(db: Database.Database, appid: string, launchExe: string): void {
  db.prepare('UPDATE games SET launch_exe = ? WHERE appid = ?').run(launchExe, appid)
}

export function deleteGame(db: Database.Database, appid: string): void {
  db.prepare('DELETE FROM achievements WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM save_locations WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM api_cache WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM games WHERE appid = ?').run(appid)
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function prepareAchievementUpsert(db: Database.Database): Database.Statement {
  return db.prepare(`
    INSERT INTO achievements (
      appid, api_name, display_name, description, icon_url,
      icon_gray_url, global_percent, earned, earned_time, trophy_tier, hidden,
      progress, max_progress
    )
    VALUES (
      @appid, @api_name, @display_name, @description, @icon_url,
      @icon_gray_url, @global_percent, @earned, @earned_time, @trophy_tier, @hidden,
      @progress, @max_progress
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
      hidden         = excluded.hidden,
      progress       = excluded.progress,
      max_progress   = excluded.max_progress
  `)
}

function runAchievementUpserts(
  stmt: Database.Statement,
  achievements: Achievement[]
): void {
  for (const row of achievements) {
    stmt.run({
      ...row,
      progress: row.progress ?? 0,
      max_progress: row.max_progress ?? 0
    })
  }
}

/**
 * Inserts or updates achievement rows without removing orphans.
 *
 * @param db - Open SQLite database.
 * @param achievements - Rows to upsert.
 */
export function upsertAchievements(db: Database.Database, achievements: Achievement[]): void {
  const stmt = prepareAchievementUpsert(db)
  const insertMany = db.transaction((rows: Achievement[]) => {
    runAchievementUpserts(stmt, rows)
  })
  insertMany(achievements)
}

/**
 * Replaces all achievement rows for one game so the table matches the catalog exactly.
 * Deletes existing rows for `appid`, then inserts `achievements` in one transaction.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param achievements - Full replacement set (may be empty).
 */
export function replaceAchievementsForGame(
  db: Database.Database,
  appid: string,
  achievements: Achievement[]
): void {
  const stmt = prepareAchievementUpsert(db)
  const replace = db.transaction((rows: Achievement[]) => {
    db.prepare('DELETE FROM achievements WHERE appid = ?').run(appid)
    runAchievementUpserts(stmt, rows)
  })
  replace(achievements)
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
