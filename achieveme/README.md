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

**Achievement catalog:** Steam Web API `GetSchemaForGame` owns the achievement list (names, icons, descriptions). Emulator save files only supply unlock progress. Successful schema downloads are cached in SQLite; Library / per-game **Refresh** force-redownloads and overwrites the cache, then **replaces** that game’s achievement rows so obsolete names (for example invented INI meta sections) are dropped. If a live fetch fails, AchieveMe reuses the last cached schema. Without a Steam API key and with no cache, the achievement list stays empty until you add a key and Refresh. When Steam responds successfully but publishes no achievement list yet (common for unreleased titles), game detail explains that instead of asking for an API key.

## In-app help

The app includes a **Help** page (top nav and Library header) with guides for discovery, sync, scoring, backup, and FAQ. Contextual **?** tooltips appear on Dashboard stats, Library Refresh, Settings sections, and game detail controls. First launch shows a welcome dialog; the Library shows a one-time long-press tip.

Help copy lives in `src/renderer/src/lib/helpContent.ts`.

## Play session features

AchieveMe can run in the **system tray** after you close the window (Settings → Tray & startup). Optionally **launch when Windows starts**, and **start minimized to tray on login** (login launch only — opening the app yourself still shows the window). While watching save folders it shows a **Steam-style unlock toast** at the **top center** (icon hold with rarity pulse + border shimmer, expand with content wipe / staggered text, then XP drop-in + count-up after fully open; exit fades copy then shrinks) and optional **unlock sound** — **one chime per toast** when several unlocks queue (Windows default notify chime or a custom **`.wav` / `.mp3`**, with a **0–100% volume** slider in Settings → Notifications — Save before Test notification uses a newly browsed file or volume). The toast window is fully transparent outside the rounded card (no black rectangle behind it on Windows). Hitting **100%** on a game fires a one-time **platinum** toast. Live changes only; Library Refresh and first scan never toast existing unlocks. Use **Test notification** in Settings to cycle all four rarity skins (works after Quit + relaunch and after close-to-tray).

**Progress bars** on game detail show partial achievement progress from Goldberg/GSE `progress` / `max_progress` fields in `achievements.json`.

**Achievement icons** are live Steam CDN URLs from `GetSchemaForGame` (not downloaded to disk). Display normalizes hashes and legacy `steamcdn-a.akamaihd.net` schema URLs to `shared.akamai.steamstatic.com/community_assets/...`.

**Playtime** is tracked for games set up via **Add Game** (install folder stored on disk). Dashboard, game detail, and library cards/rows always show tracked playtime (or `—` when none yet). On the Emulator step you can mark a game as **Denuvo offline activated** so AchieveMe keeps existing `configs.user.ini`, `configs.overlay.ini`, `configs.app.ini`, and `configs.main.ini` when replacing `steam_settings` (back up that folder first if it already exists).

**Play** on game detail launches a remembered `.exe` when **Play games from launcher** is enabled on the Library toolbar (default on). Button labels: **Set install folder** when there is no install path (browse, then pick an exe in the modal), **Select exe** when a path exists but no exe is chosen, **Play** once an exe is saved. Picking an executable only saves it — it does not launch; use **Play** afterward. When an install path exists, AchieveMe climbs from the steam DLL / `install_path` folder until a parent folder name matches (or is similar to) the game name, then lists `.exe` files under that game root. Ambiguous matches (e.g. folder `P5X` vs a long title) ask “Is this the game’s folder?” before listing.

## Tools (Steamless)

**Tools** (nav between Library and Settings) hosts external utilities. Link a Steamless release folder in **Settings → External tools** (`Steamless.CLI.exe` + `Plugins` required; not shipped with AchieveMe). The Steamless wizard lists library games, prefers `launch_exe`, otherwise resolves executables from `install_path`, or **Search for executable…** on disk, then runs `Steamless.CLI.exe --recalcchecksum`. Typical output is `Game.exe.unpacked.exe` next to the input; AchieveMe does not auto-change Play.

**Session recap** opens in the main window when a tracked play session ends (at least 1 minute): time played, unlocks during that window, and XP gained. Toggle in Settings; use **Test session recap** to preview with a random library game.

## Dashboard

The **Dashboard** is the progress pulse home screen: level + XP ring, library snapshot, proportional trophy shelf, monthly unlock chart, recent unlocks, and games close to 100%. Stats are precomputed in `profile_stats.json` via `src/main/achievement/profileStatsService.ts` (regenerated on library refresh and save-file updates). Legacy stats files missing new fields are normalized at read time; run **Refresh** in Library to populate recent unlocks and near-completion games.

## Development

```bash
cd achieveme
npm install
npm run dev
```

Only one AchieveMe process may own `%APPDATA%\achieveme` at a time. The app uses Electron’s single-instance lock; a second launch focuses the existing window and exits. If you see Chromium logs like `Unable to move the cache: Access is denied` / `Gpu Cache Creation failed`, Quit from the tray (not just close the window), end leftover `AchieveMe.exe` / `electron.exe` processes, then restart `npm run dev`. With the app fully closed you can also delete `%APPDATA%\achieveme\GPUCache` and `Code Cache` (SQLite and settings are left alone).

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
2. That folder must include `generate_emu_config.exe`, `_internal/`, and `my_login.txt` (username on line 1, password on line 2 — required so packaged Add Game does not prompt for Steam login)
3. Place the Goldberg **regular** release beside the repo: `goldberg-files/release/regular/` with `x64/steam_api64.dll` and `x86/steam_api.dll` (optional emulator DLL install in Add Game)
4. The build still excludes `_OUTPUT/`, `appid_finder/`, and `bat/` even if they exist locally. `my_login.txt` **is** bundled into both Setup and Portable.

### Build

```bash
cd achieveme
npm install
npm run build
```

Build outputs:

| Artifact | Path |
|----------|------|
| Installer (NSIS) | `achieveme/release/0.1.0/AchieveMe-Windows-0.1.0-Setup.exe` |
| Portable (no install/uninstall) | `achieveme/release/0.1.0/AchieveMe-Windows-0.1.0-Portable.exe` |

Run the portable exe directly; no installer or uninstaller. After install (or from portable unpack), the generator lives at `resources/generate_emu_config/generate_emu_config.exe` next to the app binary. The regular emu DLLs live at `resources/goldberg_release/regular/`.

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
4. **Add game** — Open Add Game, pick a title, browse for `steam_api.dll` or `steam_api64.dll`, then on the Emulator step leave “Also apply the Goldberg emulator?” unchecked and apply. Confirm `steam_settings` is installed and the game DLL is unchanged. Repeat with the option checked and confirm `steam_api(64).dll.bak` plus the regular emu DLL. For Denuvo offline-activated games: check that option, note the backup warning, apply against a folder that already has `steam_settings` with custom `configs.user.ini` / `configs.overlay.ini` / `configs.app.ini` / `configs.main.ini` — those four files must keep their old contents while other generator files update.
5. **Long-press card menu** — Quick-click a library card to open game detail with no hold blur or progress flash. Hold ~0.5s to show a dark overlay with horizontal Open / Refresh / Delete chips; releasing or moving off the card before the menu opens dismisses the overlay instantly (no left-to-right blur sweep). Delete confirms inline and removes the game; Refresh updates that game only.
6. **Library search/sort** — Search by name and switch sort modes (least complete, most unlocked, recently unlocked). Hover game cards for a blue glow.
7. **Live library update** — With the library open, edit a game's `achievements.json` on disk and save; the card fraction, %, and progress bar should update within ~1s without opening the game. Dashboard stats and open game detail should also refresh automatically.
8. **Game detail nav & hidden descriptions** — Open a game from the library; confirm **← Library** and **Refresh all** appear as frosted pills on the hero (no separate top nav). Use the left/right arrow buttons on the screen edges to move through games in the library's current sort order without returning to the list; each transition should slide in from the direction of travel. For games with unearned hidden achievements, use the **Hidden** filter pill (with count) to toggle description text; achievement rows always stay visible. With **Play games from launcher** checked on the Library toolbar, use **Set install folder** / **Select exe** / **Play** next to the title (and the chevron → Change executable) to attach a folder, pick any `.exe` under the resolved tree (save only), then launch with **Play**.
9. **Help & tooltips** — Open **Help** from the nav; confirm sections load. Click **?** on Dashboard stats and Library Refresh; dismiss first-run welcome and long-press coach mark on Library.
10. **Tray & unlock toast** — Close the window; confirm tray icon remains (Settings → Tray & startup). Edit a save file to unlock **several** achievements at once; confirm each sequential toast plays its own chime (not only the first). Confirm no sharp black rectangle around the rounded toast (desktop visible through corners). Or use Settings → Notifications → Test notification. Click opens the game; Tray → Show restores the window; Quit exits. Re-test after Quit + relaunch and after close-to-tray → Show; toast and sound should still work. Custom sound: browse a `.wav` or `.mp3`, set volume, Save, then Test.
11. **Startup & start minimized** — Settings → Tray & startup → enable Launch when Windows starts → Save; confirm Task Manager → Startup lists AchieveMe. Enable Start minimized to tray on login → Quit → relaunch with `--hidden` (or reboot); tray icon present, no main window; Tray → Show opens UI. Launch without `--hidden` still shows the window.
12. **Sound volume** — Settings → Notifications → set Unlock sound volume to ~30% → Save → Test notification (quieter). Set 0% → Save → Test (toast, no sound).
13. **Progress bars** — Open a Goldberg/GSE game with `progress`/`max_progress` in its save; confirm unearned rows show a partial bar on game detail.
14. **Playtime** — Add a game via Add Game, launch its `.exe`, play briefly, close it; confirm playtime appears on game detail and Dashboard snapshot after ~15s.
15. **Session recap** — Settings → Test session recap with ≥1 library game; confirm modal shows random game, duration, unlocks/XP. For a real recap: play a tracked game ≥1 minute then quit; modal should appear (toggle off suppresses real recaps only).

### In-detail navigation

Left/right arrow buttons in the game detail view let you browse through the library's current sorted order without returning to the library list. The order follows the active sort and search filter at the time of entry.
