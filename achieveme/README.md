# AchieveMe

AchieveMe is a desktop app (Electron) that tracks Steam achievements across emulator save formats. It watches Goldberg, GSE, CODEX, and RUNE save folders, merges progress into a local library, and enriches achievements with Steam Web API metadata.

## Supported emulator sources

| Source | Default path | Save file |
|--------|--------------|-----------|
| goldberg | `%APPDATA%\Goldberg SteamEmu Saves` | `achievements.json` |
| gse | `%APPDATA%\GSE Saves` | `achievements.json` |
| codex | `%PUBLIC%\Documents\Steam\CODEX` | `achievements.ini` |
| rune | `%PUBLIC%\Documents\Steam\RUNE` | `achievements.ini` |

Goldberg and GSE saves can be written back on import. CODEX and RUNE are read-only.

## In-app help

The app includes a **Help** page (top nav and Library header) with guides for discovery, sync, scoring, backup, and FAQ. Contextual **?** tooltips appear on Dashboard stats, Library Refresh, Settings sections, and game detail controls. First launch shows a welcome dialog; the Library shows a one-time long-press tip.

Help copy lives in `src/renderer/src/lib/helpContent.ts`.

## Play session features

AchieveMe can run in the **system tray** after you close the window (Settings → Notifications & Tray). While watching save folders it shows a **Steam-style unlock toast** at the **top center** (icon hold with rarity pulse + border shimmer, expand with content wipe / staggered text, then XP drop-in + count-up after fully open; exit fades copy then shrinks) and optional **unlock sound** when a new achievement appears in a save file. Hitting **100%** on a game fires a one-time **platinum** toast. Live changes only; Library Refresh and first scan never toast existing unlocks. Use **Test notification** in Settings to cycle all four rarity skins.

**Progress bars** on game detail show partial achievement progress from Goldberg/GSE `progress` / `max_progress` fields in `achievements.json`.

**Playtime** is tracked for games set up via **Add Game** (install folder stored on disk). Dashboard, game detail, and library cards/rows always show tracked playtime (or `—` when none yet).

**Session recap** opens in the main window when a tracked play session ends (at least 1 minute): time played, unlocks during that window, and XP gained. Toggle in Settings; use **Test session recap** to preview with a random library game.

## Dashboard

The **Dashboard** is the progress pulse home screen: level + XP ring, library snapshot, proportional trophy shelf, monthly unlock chart, recent unlocks, and games close to 100%. Stats are precomputed in `profile_stats.json` via `src/main/achievement/profileStatsService.ts` (regenerated on library refresh and save-file updates). Legacy stats files missing new fields are normalized at read time; run **Refresh** in Library to populate recent unlocks and near-completion games.

## Development

```bash
cd achieveme
npm install
npm run dev
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Electron in development mode |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check (main + renderer) |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (`node:test`) |

## Packaging (Windows)

AchieveMe ships as a Windows NSIS installer built with `electron-builder`.

### Prerequisites

1. Place the Goldberg generator beside the repo (gitignored): `goldberg-files/generate_emu_config/`
2. That folder must include `generate_emu_config.exe` and `_internal/` (Add Game depends on it)
3. Do **not** ship `my_login.txt` (Steam credentials). The build excludes `_OUTPUT/`, `appid_finder/`, `bat/`, and `my_login.txt` even if they exist locally.

### Build

```bash
cd achieveme
npm install
npm run build
```

The installer is written to:

`achieveme/release/0.1.0/AchieveMe-Windows-0.1.0-Setup.exe`

After install, the generator lives at `resources/generate_emu_config/generate_emu_config.exe` next to the app binary.

## Backup & restore

Settings provides two backup actions:

| Action | What it includes |
|--------|------------------|
| **Export** | Full ZIP backup: library metadata plus every file under each Goldberg/GSE `{appid}\` folder and the emulator-root `settings\` folder (v3) |
| **Import** | Restores library and merges ZIP files **one-by-one** into emulator folders |

### Backup ZIP layout

```
achieveme-backup.zip
├── manifest.json          (formatVersion: 3)
├── saves/gse/settings/    (global GSE settings: steam id, language, etc.)
└── saves/gse/{appid}/
    ├── achievements.json
    ├── settings/            (per-game settings, if present)
    └── (any other files in that appid folder)
```

### Import merge behavior

Full Backup import **does not delete** emulator folders. It only overwrites files that exist in the backup. Other appid folders already on disk are left untouched.

## Manual test checklist

1. **Export** — With at least one GSE game that has an extra file in its appid folder, export a ZIP and confirm `manifest.json` has `formatVersion: 3` and the zip contains both `achievements.json` and the extra file.
2. **Import merge** — Keep a second appid folder on disk that is *not* in the backup. Import the ZIP and confirm the backed-up game is restored while the other appid folder is unchanged.
3. **Refresh prune** — Delete `achievements.json` for a game, click Refresh; the game should disappear from the library.
4. **Add game** — Open Add Game, pick a title, browse for `steam_api.dll` or `steam_api64.dll` in the game folder; apply runs the generator and installs `steam_settings` beside the DLL (replacing any existing folder).
5. **Long-press card menu** — Quick-click a library card to open game detail with no hold blur or progress flash. Hold ~0.5s to show a dark overlay with horizontal Open / Refresh / Delete chips; releasing or moving off the card before the menu opens dismisses the overlay instantly (no left-to-right blur sweep). Delete confirms inline and removes the game; Refresh updates that game only.
6. **Library search/sort** — Search by name and switch sort modes (least complete, most unlocked, recently unlocked). Hover game cards for a blue glow.
7. **Live library update** — With the library open, edit a game's `achievements.json` on disk and save; the card fraction, %, and progress bar should update within ~1s without opening the game. Dashboard stats and open game detail should also refresh automatically.
8. **Game detail nav & hidden descriptions** — Open a game from the library; confirm **← Library** and **Refresh all** appear as frosted pills on the hero (no separate top nav). Use the left/right arrow buttons on the screen edges to move through games in the library's current sort order without returning to the list; each transition should slide in from the direction of travel. For games with unearned hidden achievements, use the **Hidden** filter pill (with count) to toggle description text; achievement rows always stay visible.
9. **Help & tooltips** — Open **Help** from the nav; confirm sections load. Click **?** on Dashboard stats and Library Refresh; dismiss first-run welcome and long-press coach mark on Library.
10. **Tray & unlock toast** — Close the window; confirm tray icon remains. Edit a save file to unlock an achievement; confirm the AchieveMe toast appears top-center (icon pulse → expand with staggered text/XP → text fades then shrink) with sound if enabled. Or use Settings → Test notification. Click opens the game; Tray → Show restores the window; Quit exits.
11. **Progress bars** — Open a Goldberg/GSE game with `progress`/`max_progress` in its save; confirm unearned rows show a partial bar on game detail.
12. **Playtime** — Add a game via Add Game, launch its `.exe`, play briefly, close it; confirm playtime appears on game detail and Dashboard snapshot after ~15s.
13. **Session recap** — Settings → Test session recap with ≥1 library game; confirm modal shows random game, duration, unlocks/XP. For a real recap: play a tracked game ≥1 minute then quit; modal should appear (toggle off suppresses real recaps only).

### In-detail navigation

Left/right arrow buttons in the game detail view let you browse through the library's current sorted order without returning to the library list. The order follows the active sort and search filter at the time of entry.
