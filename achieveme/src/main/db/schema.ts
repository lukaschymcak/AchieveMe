import type Database from 'better-sqlite3'

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

export function migrateSchema(db: Database.Database): void {
  if (!columnExists(db, 'achievements', 'progress')) {
    db.exec('ALTER TABLE achievements ADD COLUMN progress INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'achievements', 'max_progress')) {
    db.exec('ALTER TABLE achievements ADD COLUMN max_progress INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'games', 'playtime_seconds')) {
    db.exec('ALTER TABLE games ADD COLUMN playtime_seconds INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'games', 'install_path')) {
    db.exec("ALTER TABLE games ADD COLUMN install_path TEXT NOT NULL DEFAULT ''")
  }
}

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      appid                 TEXT    PRIMARY KEY,
      name                  TEXT    NOT NULL DEFAULT '',
      total_achievements    INTEGER NOT NULL DEFAULT 0,
      unlocked_achievements INTEGER NOT NULL DEFAULT 0,
      completion_pct        REAL    NOT NULL DEFAULT 0,
      has_platinum          INTEGER NOT NULL DEFAULT 0,
      last_unlocked_at      INTEGER NOT NULL DEFAULT 0,
      schema_fetched_at     INTEGER NOT NULL DEFAULT 0,
      playtime_seconds      INTEGER NOT NULL DEFAULT 0,
      install_path          TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS achievements (
      appid         TEXT    NOT NULL,
      api_name      TEXT    NOT NULL,
      display_name  TEXT    NOT NULL DEFAULT '',
      description   TEXT    NOT NULL DEFAULT '',
      icon_url      TEXT    NOT NULL DEFAULT '',
      icon_gray_url TEXT    NOT NULL DEFAULT '',
      global_percent REAL   NOT NULL DEFAULT 0,
      earned        INTEGER NOT NULL DEFAULT 0,
      earned_time   INTEGER NOT NULL DEFAULT 0,
      trophy_tier   TEXT    NOT NULL DEFAULT 'bronze',
      hidden        INTEGER NOT NULL DEFAULT 0,
      progress      INTEGER NOT NULL DEFAULT 0,
      max_progress  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (appid, api_name)
    );

    CREATE TABLE IF NOT EXISTS api_cache (
      appid      TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      data_json  TEXT    NOT NULL,
      cached_at  INTEGER NOT NULL,
      PRIMARY KEY (appid, type)
    );

    CREATE TABLE IF NOT EXISTS save_locations (
      appid          TEXT    NOT NULL,
      source         TEXT    NOT NULL,
      file_path      TEXT    NOT NULL,
      root_kind      TEXT    NOT NULL DEFAULT 'default',
      root_source    TEXT    NOT NULL DEFAULT '',
      custom_root    TEXT    NOT NULL DEFAULT '',
      relative_path  TEXT    NOT NULL DEFAULT '',
      updated_at     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (appid, source, file_path)
    );
  `)
}
