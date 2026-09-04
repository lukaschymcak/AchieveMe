import type Database from 'better-sqlite3'
import type { Game, Achievement, SaveLocation, UpdateStatus } from '../../shared/types'

const GAME_COLUMNS =
  'appid, name, total_achievements, unlocked_achievements, completion_pct, has_platinum, last_unlocked_at, schema_fetched_at, playtime_seconds, install_path, launch_exe, manifest_gids, update_status, backup_status, backup_at, backup_error, ludusavi_title, steamless_applied, goldberg_applied, steamless_exe, goldberg_dll_path'

function normalizeGameRow(row: Game | undefined): Game | undefined {
  if (!row) return undefined
  return {
    ...row,
    playtime_seconds: row.playtime_seconds ?? 0,
    install_path: row.install_path ?? '',
    launch_exe: row.launch_exe ?? '',
    manifest_gids: row.manifest_gids ?? '',
    update_status: (row.update_status ?? '') as UpdateStatus,
    backup_status: row.backup_status ?? '',
    backup_at: row.backup_at ?? 0,
    backup_error: row.backup_error ?? '',
    ludusavi_title: row.ludusavi_title ?? '',
    steamless_applied: row.steamless_applied ?? 0,
    goldberg_applied: row.goldberg_applied ?? 0,
    steamless_exe: row.steamless_exe ?? '',
    goldberg_dll_path: row.goldberg_dll_path ?? ''
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
  const backupStatus = game.backup_status ?? existing?.backup_status ?? ''
  const backupAt = game.backup_at ?? existing?.backup_at ?? 0
  const backupError = game.backup_error ?? existing?.backup_error ?? ''
  const ludusaviTitle = game.ludusavi_title ?? existing?.ludusavi_title ?? ''
  const steamlessApplied = game.steamless_applied ?? existing?.steamless_applied ?? 0
  const goldbergApplied = game.goldberg_applied ?? existing?.goldberg_applied ?? 0
  const steamlessExe = game.steamless_exe ?? existing?.steamless_exe ?? ''
  const goldbergDllPath = game.goldberg_dll_path ?? existing?.goldberg_dll_path ?? ''

  db.prepare(`
    INSERT INTO games (
      appid, name, total_achievements, unlocked_achievements,
      completion_pct, has_platinum, last_unlocked_at, schema_fetched_at,
      playtime_seconds, install_path, launch_exe, manifest_gids, update_status,
      backup_status, backup_at, backup_error, ludusavi_title,
      steamless_applied, goldberg_applied, steamless_exe, goldberg_dll_path
    )
    VALUES (
      @appid, @name, @total_achievements, @unlocked_achievements,
      @completion_pct, @has_platinum, @last_unlocked_at, @schema_fetched_at,
      @playtime_seconds, @install_path, @launch_exe, @manifest_gids, @update_status,
      @backup_status, @backup_at, @backup_error, @ludusavi_title,
      @steamless_applied, @goldberg_applied, @steamless_exe, @goldberg_dll_path
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
      END,
      backup_status         = games.backup_status,
      backup_at             = games.backup_at,
      backup_error          = games.backup_error,
      ludusavi_title        = CASE
        WHEN excluded.ludusavi_title != '' THEN excluded.ludusavi_title
        ELSE games.ludusavi_title
      END,
      steamless_applied     = games.steamless_applied,
      goldberg_applied      = games.goldberg_applied,
      steamless_exe         = games.steamless_exe,
      goldberg_dll_path     = games.goldberg_dll_path
  `).run({
    ...game,
    playtime_seconds: playtimeSeconds,
    install_path: installPath,
    launch_exe: launchExe,
    manifest_gids: manifestGids,
    update_status: updateStatus,
    backup_status: backupStatus,
    backup_at: backupAt,
    backup_error: backupError,
    ludusavi_title: ludusaviTitle,
    steamless_applied: steamlessApplied,
    goldberg_applied: goldbergApplied,
    steamless_exe: steamlessExe,
    goldberg_dll_path: goldbergDllPath
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
  unignoreAppid(db, cleanAppid)
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

/**
 * Persists Steamless / Goldberg apply flags and last paths for a game.
 * Only updates keys present on `patch`.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param patch - Partial tool-apply fields to write.
 */
export function saveGameToolApply(
  db: Database.Database,
  appid: string,
  patch: {
    steamlessApplied?: boolean
    goldbergApplied?: boolean
    steamlessExe?: string
    goldbergDllPath?: string
  }
): void {
  const clean = String(appid || '').trim()
  if (!clean) throw new Error('Invalid AppID for tool apply flags.')

  const sets: string[] = []
  const values: Array<string | number> = []

  if (patch.steamlessApplied !== undefined) {
    sets.push('steamless_applied = ?')
    values.push(patch.steamlessApplied ? 1 : 0)
  }
  if (patch.goldbergApplied !== undefined) {
    sets.push('goldberg_applied = ?')
    values.push(patch.goldbergApplied ? 1 : 0)
  }
  if (patch.steamlessExe !== undefined) {
    sets.push('steamless_exe = ?')
    values.push(String(patch.steamlessExe).trim())
  }
  if (patch.goldbergDllPath !== undefined) {
    sets.push('goldberg_dll_path = ?')
    values.push(String(patch.goldbergDllPath).trim())
  }

  if (!sets.length) return

  values.push(clean)
  db.prepare(`UPDATE games SET ${sets.join(', ')} WHERE appid = ?`).run(...values)
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

export interface GameBackupStatusUpdate {
  status: string
  at: number
  error?: string
  ludusaviTitle?: string
}

/**
 * Persists Ludusavi backup status fields for a library game.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 * @param update - Status, timestamp, optional error and cached title.
 */
export function updateGameBackupStatus(
  db: Database.Database,
  appid: string,
  update: GameBackupStatusUpdate
): void {
  const cleanAppid = String(appid || '').trim()
  if (!cleanAppid) return
  const status = String(update.status || '')
  const at = Number.isFinite(update.at) ? Math.floor(update.at) : 0
  const error = String(update.error ?? '')
  const existing = getGame(db, cleanAppid)
  const ludusaviTitle =
    update.ludusaviTitle !== undefined
      ? String(update.ludusaviTitle)
      : (existing?.ludusavi_title ?? '')

  db.prepare(`
    UPDATE games
    SET backup_status = ?, backup_at = ?, backup_error = ?, ludusavi_title = ?
    WHERE appid = ?
  `).run(status, at, error, ludusaviTitle, cleanAppid)
}

export function deleteGame(db: Database.Database, appid: string): void {
  db.prepare('DELETE FROM achievements WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM save_locations WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM api_cache WHERE appid = ?').run(appid)
  db.prepare('DELETE FROM games WHERE appid = ?').run(appid)
}

function cleanNumericAppid(appid: string): string | null {
  const clean = String(appid || '').trim()
  if (!/^\d+$/.test(clean)) return null
  return clean
}

/**
 * Marks an AppID as ignored so rescans do not re-add it after Delete.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID (digits only).
 */
export function ignoreAppid(db: Database.Database, appid: string): void {
  const clean = cleanNumericAppid(appid)
  if (!clean) return
  const ignoredAt = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO ignored_appids (appid, ignored_at)
    VALUES (?, ?)
    ON CONFLICT(appid) DO UPDATE SET ignored_at = excluded.ignored_at
  `).run(clean, ignoredAt)
}

/**
 * Removes an AppID from the ignore list (explicit Add / Import / depot).
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 */
export function unignoreAppid(db: Database.Database, appid: string): void {
  const clean = cleanNumericAppid(appid)
  if (!clean) return
  db.prepare('DELETE FROM ignored_appids WHERE appid = ?').run(clean)
}

/**
 * Returns whether an AppID is currently ignored.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 */
export function isAppidIgnored(db: Database.Database, appid: string): boolean {
  const clean = cleanNumericAppid(appid)
  if (!clean) return false
  const row = db.prepare('SELECT 1 FROM ignored_appids WHERE appid = ?').get(clean) as
    | { 1?: number }
    | undefined
  return Boolean(row)
}

/**
 * Lists all ignored numeric AppIDs.
 *
 * @param db - Open SQLite database.
 */
export function getIgnoredAppids(db: Database.Database): string[] {
  const rows = db.prepare('SELECT appid FROM ignored_appids').all() as Array<{ appid: string }>
  return rows.map((row) => row.appid).filter((id) => /^\d+$/.test(id))
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

/**
 * Deletes one api_cache row.
 *
 * @param db - Open SQLite database.
 * @param appid - Cache appid key.
 * @param type - Cache type key.
 */
export function deleteCacheEntry(db: Database.Database, appid: string, type: string): void {
  db.prepare('DELETE FROM api_cache WHERE appid = ? AND type = ?').run(appid, type)
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
