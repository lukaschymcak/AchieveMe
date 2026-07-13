# AchieveMe

AchieveMe is a desktop app (Electron) that tracks Steam achievements across emulator save formats. It watches Goldberg, GSE, CODEX, RUNE, Hoodlum, CreamAPI, and Reloaded save folders, merges progress into a local library, and enriches achievements with Steam Web API metadata.

## Supported emulator sources

| Source | Default path | Save file |
|--------|--------------|-----------|
| goldberg | `%APPDATA%\Goldberg SteamEmu Saves` | `achievements.json` |
| gse | `%APPDATA%\GSE Saves` | `achievements.json` |
| codex | `%PUBLIC%\Documents\Steam\CODEX` | `achievements.ini` |
| rune | `%PUBLIC%\Documents\Steam\RUNE` | `achievements.ini` |
| hoodlum | *(custom folders only)* | `hlm.ini` |
| creamapi | `%APPDATA%\CreamAPI` | `CreamAPI.Achievements.cfg` |
| reloaded | `%PROGRAMDATA%\Steam` | `achievements.ini` |

Goldberg and GSE saves can be written back on import. All other sources are read-only.

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
4. **Delete game** — Click **Delete** in the library toolbar (cursor becomes crosshair), click a game card, confirm on the inline "Are you sure?" overlay; verify the game is removed from the app and its save folder is deleted from disk.
5. **Library search/sort** — Search by name and switch sort modes (least complete, most unlocked, recently unlocked). Hover game cards for a blue glow; enable **Delete** mode to see the red grid tint, red card hover, pending pulse, and delete fade-out.
6. **Game detail nav & hidden descriptions** — Open a game from the library; confirm **← Library** and **Refresh** appear as frosted pills on the hero (no separate top nav). Use the left/right arrow buttons on the screen edges to move through games in the library's current sort order without returning to the list; each transition should slide in from the direction of travel. For games with unearned hidden achievements, use the **Hidden** filter pill (with count) to toggle description text; achievement rows always stay visible.

### In-detail navigation

Left/right arrow buttons in the game detail view let you browse through the library's current sorted order without returning to the library list. The order follows the active sort and search filter at the time of entry.
