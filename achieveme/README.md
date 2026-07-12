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

Settings provides four backup actions:

| Action | What it includes | Best for |
|--------|------------------|----------|
| **Export JSON** | SQLite games/achievements + Goldberg/GSE `achievements.json` progress (v2) | Lightweight transfer, version control |
| **Export Full Backup** | Same metadata plus every file under each Goldberg/GSE `{appid}\` folder and the emulator-root `settings\` folder (v3 ZIP) | Moving extra save files alongside achievements |
| **Import JSON** | Restores library and writes `achievements.json` files | Round-trip JSON backups |
| **Import Full Backup** | Restores library and merges ZIP files **one-by-one** into emulator folders | Restoring full appid folders |

### Full Backup ZIP layout

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

JSON import writes Goldberg/GSE achievement files only, not arbitrary sibling files.

## Manual test checklist

1. **Export Full Backup** — With at least one GSE game that has an extra file in its appid folder, export a ZIP and confirm `manifest.json` has `formatVersion: 3` and the zip contains both `achievements.json` and the extra file.
2. **Import merge** — Keep a second appid folder on disk that is *not* in the backup. Import the ZIP and confirm the backed-up game is restored while the other appid folder is unchanged.
3. **JSON round-trip** — Export JSON, import JSON; achievements restore without using ZIP.
4. **Orphan prune** — Delete `achievements.json` for a game, restart the app; the game should disappear from the library (existing behavior).
