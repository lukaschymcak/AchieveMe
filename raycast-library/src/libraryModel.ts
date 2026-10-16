/**
 * Shared types and pure formatting helpers for the AchieveMe Raycast extension.
 * No Raycast API imports here — pure TS, testable in isolation.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Subset of the `games` SQLite row we actually use in the extension. */
export interface LibraryGame {
  appid: string;
  name: string;
  total_achievements: number;
  unlocked_achievements: number;
  completion_pct: number;
  has_platinum: number; // 0 | 1
  last_unlocked_at: number; // unix seconds
  playtime_seconds: number;
  install_path: string;
  launch_exe: string;
  launch_args: string;
  /** Steam Store `header_image` from AchieveMe's api_cache, or empty. */
  header_image: string;
  /** Local cached cover, Store header URL, or legacy portrait URL. */
  cover_source: string;
}

// ── Formatters ───────────────────────────────────────────────────────────────

/**
 * "124h 31m" / "45m" / "< 1m"
 */
export function formatPlaytime(seconds: number): string {
  if (seconds <= 0) return "No playtime";
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * "48 / 73" — if no achievements returns null so the caller can hide it.
 */
export function formatAchievements(game: LibraryGame): string | null {
  if (game.total_achievements === 0) return null;
  return `${game.unlocked_achievements} / ${game.total_achievements}`;
}

/**
 * Completion as "65%" or "100% 🏆" when platinum.
 */
export function formatCompletion(game: LibraryGame): string {
  const pct = Math.round(game.completion_pct);
  if (game.has_platinum) return `${pct}% 🏆`;
  return `${pct}%`;
}

/**
 * Legacy Steam library portrait. Newer apps often 404 here; the Store
 * `header_image` URL is the one AchieveMe actually caches.
 */
export function steamCoverUrl(appid: string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}

/** Pull `header_image` out of an AchieveMe `api_cache` appdetails blob. */
export function readHeaderImage(dataJson: string | undefined): string {
  if (!dataJson) return "";
  try {
    const parsed = JSON.parse(dataJson) as { header_image?: unknown };
    return typeof parsed.header_image === "string" ? parsed.header_image.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Same art AchieveMe shows: the file it already downloaded, then the Store
 * header URL it stored, then the old portrait URL.
 */
export function pickCoverSource(
  localCoverPath: string | null,
  headerImage: string,
  appid: string
): string {
  if (localCoverPath) return localCoverPath;
  if (headerImage.trim()) return headerImage.trim();
  return steamCoverUrl(appid);
}

export function steamHeaderUrl(appid: string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/**
 * "Last achievement: 3 days ago" / "Last achievement: Jan 5, 2024" / null
 */
export function formatLastUnlock(unixSeconds: number): string | null {
  if (!unixSeconds) return null;
  const date = new Date(unixSeconds * 1000);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Last unlock: today";
  if (diffDays === 1) return "Last unlock: yesterday";
  if (diffDays < 30) return `Last unlock: ${diffDays}d ago`;
  if (diffDays < 365) return `Last unlock: ${Math.floor(diffDays / 30)}mo ago`;
  return `Last unlock: ${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Splits launch args the same way AchieveMe does: whitespace, with double quotes kept as groups.
 */
export function tokenizeLaunchArgs(raw: string): string[] {
  const input = raw.trim();
  if (!input) return [];

  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

/**
 * Case-insensitive substring match across name.
 */
export function matchesSearch(game: LibraryGame, query: string): boolean {
  if (!query.trim()) return true;
  return game.name.toLowerCase().includes(query.toLowerCase().trim());
}

/** Detail art is scaled to this width so a full-size header cannot scroll the panel. */
const DETAIL_IMAGE_WIDTH = 360;

/**
 * Raycast scales a markdown image when the URL includes `raycast-width`.
 * Existing query strings (Steam's `?t=`) stay intact.
 */
export function raycastSizedImageUrl(url: string, width = DETAIL_IMAGE_WIDTH): string {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}raycast-width=${width}`;
}

/**
 * Markdown string for the detail panel.
 */
export function buildDetailMarkdown(game: LibraryGame): string {
  const cover = raycastSizedImageUrl(game.header_image || steamHeaderUrl(game.appid));
  return `![${game.name}](${cover})`;
}

/**
 * Steam Store page URL.
 */
export function steamStoreUrl(appid: string): string {
  return `https://store.steampowered.com/app/${appid}`;
}
