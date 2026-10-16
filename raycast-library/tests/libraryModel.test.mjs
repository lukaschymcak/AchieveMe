/**
 * Tests for libraryModel.ts pure helpers.
 * Run with: node --experimental-strip-types --test tests/libraryModel.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We import via .ts source directly using strip-types
import {
  formatPlaytime,
  formatAchievements,
  formatCompletion,
  formatLastUnlock,
  matchesSearch,
  tokenizeLaunchArgs,
  pickCoverSource,
  raycastSizedImageUrl,
  readHeaderImage,
  steamCoverUrl,
  steamHeaderUrl,
} from "../src/libraryModel.ts";

// ── formatPlaytime ────────────────────────────────────────────────────────────

describe("formatPlaytime", () => {
  it("returns 'No playtime' for 0 seconds", () => {
    assert.equal(formatPlaytime(0), "No playtime");
  });

  it("returns 'No playtime' for negative", () => {
    assert.equal(formatPlaytime(-100), "No playtime");
  });

  it("returns '< 1m' for less than a minute", () => {
    assert.equal(formatPlaytime(59), "< 1m");
  });

  it("returns minutes only for < 1 hour", () => {
    assert.equal(formatPlaytime(60), "1m");
    assert.equal(formatPlaytime(2700), "45m");
    assert.equal(formatPlaytime(3599), "59m");
  });

  it("returns hours only when minutes are 0", () => {
    assert.equal(formatPlaytime(3600), "1h");
    assert.equal(formatPlaytime(7200), "2h");
  });

  it("returns hours + minutes", () => {
    assert.equal(formatPlaytime(3660), "1h 1m");
    assert.equal(formatPlaytime(447_060), "124h 11m");
  });
});

// ── formatAchievements ────────────────────────────────────────────────────────

describe("formatAchievements", () => {
  const base = {
    appid: "123",
    name: "Test",
    completion_pct: 0,
    has_platinum: 0,
    last_unlocked_at: 0,
    playtime_seconds: 0,
    install_path: "",
    launch_exe: "",
    launch_args: "",
  };

  it("returns null when total_achievements is 0", () => {
    assert.equal(formatAchievements({ ...base, total_achievements: 0, unlocked_achievements: 0 }), null);
  });

  it("returns 'unlocked / total' string", () => {
    assert.equal(formatAchievements({ ...base, total_achievements: 73, unlocked_achievements: 48 }), "48 / 73");
  });

  it("works for 0 unlocked", () => {
    assert.equal(formatAchievements({ ...base, total_achievements: 50, unlocked_achievements: 0 }), "0 / 50");
  });
});

// ── formatCompletion ──────────────────────────────────────────────────────────

describe("formatCompletion", () => {
  const base = {
    appid: "123",
    name: "Test",
    total_achievements: 10,
    unlocked_achievements: 10,
    last_unlocked_at: 0,
    playtime_seconds: 0,
    install_path: "",
    launch_exe: "",
    launch_args: "",
  };

  it("shows percentage", () => {
    assert.equal(formatCompletion({ ...base, completion_pct: 65.7, has_platinum: 0 }), "66%");
  });

  it("appends trophy emoji when platinum", () => {
    assert.equal(formatCompletion({ ...base, completion_pct: 100, has_platinum: 1 }), "100% 🏆");
  });

  it("rounds correctly", () => {
    assert.equal(formatCompletion({ ...base, completion_pct: 99.5, has_platinum: 0 }), "100%");
    assert.equal(formatCompletion({ ...base, completion_pct: 0.4, has_platinum: 0 }), "0%");
  });
});

// ── formatLastUnlock ──────────────────────────────────────────────────────────

describe("formatLastUnlock", () => {
  it("returns null for 0", () => {
    assert.equal(formatLastUnlock(0), null);
  });

  it("returns 'today' for unlock within the last 24h", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = formatLastUnlock(nowSeconds - 3600); // 1 hour ago
    assert.equal(result, "Last unlock: today");
  });

  it("returns 'yesterday' for ~24h ago", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = formatLastUnlock(nowSeconds - 86400 - 100);
    assert.equal(result, "Last unlock: yesterday");
  });

  it("returns day count for < 30 days", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = formatLastUnlock(nowSeconds - 86400 * 10);
    assert.equal(result, "Last unlock: 10d ago");
  });

  it("returns month count for < 365 days", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = formatLastUnlock(nowSeconds - 86400 * 60);
    assert.equal(result, "Last unlock: 2mo ago");
  });

  it("returns year count for >= 365 days", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = formatLastUnlock(nowSeconds - 86400 * 400);
    assert.equal(result, "Last unlock: 1y ago");
  });
});

// ── matchesSearch ─────────────────────────────────────────────────────────────

describe("tokenizeLaunchArgs", () => {
  it("matches AchieveMe: splits on whitespace and keeps quoted groups", () => {
    assert.deepEqual(tokenizeLaunchArgs(''), []);
    assert.deepEqual(tokenizeLaunchArgs('-windowed -dx12'), ["-windowed", "-dx12"]);
    assert.deepEqual(tokenizeLaunchArgs('"C:\\Path With Spaces\\mod.dll" -flag'), [
      "C:\\Path With Spaces\\mod.dll",
      "-flag",
    ]);
  });
});

describe("matchesSearch", () => {
  const game = {
    appid: "1086940",
    name: "Baldur's Gate 3",
    total_achievements: 54,
    unlocked_achievements: 20,
    completion_pct: 37,
    has_platinum: 0,
    last_unlocked_at: 0,
    playtime_seconds: 72000,
    install_path: "",
    launch_exe: "",
    launch_args: "",
  };

  it("matches empty query", () => {
    assert.ok(matchesSearch(game, ""));
    assert.ok(matchesSearch(game, "   "));
  });

  it("matches full name", () => {
    assert.ok(matchesSearch(game, "Baldur's Gate 3"));
  });

  it("matches partial name case-insensitive", () => {
    assert.ok(matchesSearch(game, "baldur"));
    assert.ok(matchesSearch(game, "GATE"));
    assert.ok(matchesSearch(game, "gate 3"));
  });

  it("does not match unrelated query", () => {
    assert.ok(!matchesSearch(game, "cyberpunk"));
    assert.ok(!matchesSearch(game, "witcher"));
  });
});

// ── URL helpers ───────────────────────────────────────────────────────────────

describe("cover source", () => {
  const hashed =
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3751260/abc/header.jpg";

  it("reads the Store header_image AchieveMe cached", () => {
    assert.equal(readHeaderImage(JSON.stringify({ header_image: hashed })), hashed);
  });

  it("returns empty for missing or broken cache JSON", () => {
    assert.equal(readHeaderImage(undefined), "");
    assert.equal(readHeaderImage("{"), "");
  });

  it("prefers the local cover file AchieveMe already downloaded", () => {
    assert.equal(pickCoverSource("C:\\covers\\cover.jpg", hashed, "3751260"), "C:\\covers\\cover.jpg");
  });

  it("uses the Store header when there is no local file", () => {
    assert.equal(pickCoverSource(null, hashed, "3751260"), hashed);
  });

  it("adds raycast-width without dropping an existing query string", () => {
    assert.equal(
      raycastSizedImageUrl("https://example.com/header.jpg?t=1"),
      "https://example.com/header.jpg?t=1&raycast-width=360"
    );
    assert.equal(
      raycastSizedImageUrl("https://example.com/header.jpg"),
      "https://example.com/header.jpg?raycast-width=360"
    );
  });

  it("falls back to the legacy portrait only when both are missing", () => {
    assert.equal(
      pickCoverSource(null, "", "1086940"),
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/library_600x900.jpg"
    );
  });
});

describe("steamCoverUrl / steamHeaderUrl", () => {
  it("generates correct cover URL", () => {
    assert.equal(
      steamCoverUrl("1086940"),
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/library_600x900.jpg"
    );
  });

  it("generates correct header URL", () => {
    assert.equal(
      steamHeaderUrl("1086940"),
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg"
    );
  });
});
