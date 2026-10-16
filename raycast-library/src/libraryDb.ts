/**
 * SQLite path resolution and data loading for the AchieveMe database.
 *
 * Uses Node.js built-in `node:sqlite` (available since Node 22.5+).
 * No native modules, no compilation, no ABI issues.
 *
 * `resolveDbPath` / `windowsDbCandidates` are pure — safe in tests.
 * `getDbPath` adds the Raycast preference check.
 * `loadGames` queries the DB and returns all library games.
 */

import os from "os";
import path from "path";
import fs from "fs";
import { pickCoverSource, readHeaderImage, type LibraryGame } from "./libraryModel";

// ── Debug logger — writes to %TEMP%\achieveme-raycast.log ────────────────────
const LOG_FILE = path.join(os.tmpdir(), "achieveme-raycast.log");

function log(msg: string): void {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* never throw from logger */ }
}

log(`=== module loaded | Node ${process.version} | platform ${process.platform} ===`);
log(`APPDATA=${process.env.APPDATA ?? "(unset)"}`);
log(`LOCALAPPDATA=${process.env.LOCALAPPDATA ?? "(unset)"}`);
log(`homedir=${os.homedir()}`);
log(`tmpdir=${os.tmpdir()}`);
log(`log file = ${LOG_FILE}`);

// ── Pure path resolution (no @raycast/api — safe in tests) ───────────────────

export function windowsDbCandidates(): string[] {
  const home = os.homedir();
  const candidates: string[] = [];

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, "achieveme", "achieveme.db"));
  }
  candidates.push(path.join(home, "AppData", "Roaming", "achieveme", "achieveme.db"));
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "achieveme", "achieveme.db"));
  }

  return [...new Set(candidates)];
}

export function resolveDbPath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) return customPath.trim();

  if (process.platform === "win32") {
    const candidates = windowsDbCandidates();
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch { /* skip */ }
    }
    return candidates[0] ?? path.join(os.homedir(), "AppData", "Roaming", "achieveme", "achieveme.db");
  }

  return path.join(os.homedir(), "Library", "Application Support", "achieveme", "achieveme.db");
}

export function getDbPath(): string {
  log("getDbPath() called");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPreferenceValues } = require("@raycast/api") as typeof import("@raycast/api");
    const prefs = getPreferenceValues<{ dbPath?: string }>();
    log(`preference dbPath = ${JSON.stringify(prefs.dbPath)}`);
    const resolved = resolveDbPath(prefs.dbPath);
    log(`resolved path (with pref) = ${resolved}`);
    return resolved;
  } catch (e) {
    log(`getPreferenceValues threw: ${e instanceof Error ? e.message : String(e)}`);
    const resolved = resolveDbPath();
    log(`resolved path (no pref) = ${resolved}`);
    return resolved;
  }
}

// ── Data loading via node:sqlite ──────────────────────────────────────────────

const GAMES_QUERY = `
  SELECT
    appid, name, total_achievements, unlocked_achievements,
    completion_pct, has_platinum, last_unlocked_at, playtime_seconds,
    install_path, launch_exe, launch_args
  FROM games
  ORDER BY completion_pct DESC, playtime_seconds DESC, name ASC
`;

/**
 * Opens the AchieveMe DB using the Node.js built-in `node:sqlite` module
 * and returns all library games. No native addon — works in any Node 22.5+ runtime.
 */
export async function loadGames(): Promise<LibraryGame[]> {
  log("loadGames() called");
  const dbPath = getDbPath();
  log(`dbPath = ${dbPath}`);
  log(`exists = ${fs.existsSync(dbPath)}`);

  if (!fs.existsSync(dbPath)) {
    const msg = `[Node ${process.version}] Database not found at: ${dbPath}`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite"));
    log("node:sqlite loaded OK");
  } catch (e) {
    const msg = `[Node ${process.version}] node:sqlite unavailable: ${e instanceof Error ? e.message : String(e)}`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  let db: InstanceType<typeof DatabaseSync> | undefined;
  try {
    log("opening database…");
    db = new DatabaseSync(dbPath, { open: true });
    log("database opened");
    const stmt = db.prepare(GAMES_QUERY);
    log("query prepared");
    const rows = stmt.all() as Array<Omit<LibraryGame, "header_image" | "cover_source">>;
    const cacheRows = db
      .prepare(`SELECT appid, data_json FROM api_cache WHERE type = 'appdetails'`)
      .all() as Array<{ appid: string; data_json: string }>;
    const headerByApp = new Map(cacheRows.map((row) => [row.appid, readHeaderImage(row.data_json)]));
    const imagesRoot = path.join(path.dirname(dbPath), "images");
    const games = rows.map((row) => {
      const headerImage = headerByApp.get(row.appid) ?? "";
      const localCover = path.join(imagesRoot, row.appid, "cover", "cover.jpg");
      return {
        ...row,
        header_image: headerImage,
        cover_source: pickCoverSource(
          fs.existsSync(localCover) ? localCover : null,
          headerImage,
          row.appid
        ),
      };
    });
    log(`query returned ${games.length} rows`);
    return games;
  } catch (e) {
    const msg = `SQLite error: ${e instanceof Error ? e.message : String(e)}`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  } finally {
    db?.close();
    log("database closed");
  }
}
