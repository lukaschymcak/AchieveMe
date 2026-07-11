import type Database from 'better-sqlite3'

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      appid                 TEXT    PRIMARY KEY,
      name                  TEXT    NOT NULL DEFAULT '',
      cover_path            TEXT    NOT NULL DEFAULT '',
      total_achievements    INTEGER NOT NULL DEFAULT 0,
      unlocked_achievements INTEGER NOT NULL DEFAULT 0,
      completion_pct        REAL    NOT NULL DEFAULT 0,
      has_platinum          INTEGER NOT NULL DEFAULT 0,
      last_unlocked_at      INTEGER NOT NULL DEFAULT 0,
      schema_fetched_at     INTEGER NOT NULL DEFAULT 0
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
      PRIMARY KEY (appid, api_name)
    );

    CREATE TABLE IF NOT EXISTS api_cache (
      appid      TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      data_json  TEXT    NOT NULL,
      cached_at  INTEGER NOT NULL,
      PRIMARY KEY (appid, type)
    );
  `)
}
