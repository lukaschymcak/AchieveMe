# AGENTS.md — AchieveMe Agent Operating Manual

Welcome to **AchieveMe**. This file is the primary onboarding guide, architecture reference, and operational playbook for AI agents working in this repository.

---

## 1. Project Identity & Creative North Star

AchieveMe is a **Windows-first desktop application** (built with Electron, React, TypeScript, and SQLite) designed as a **PlayStation-style trophy profile and showcase for emulated / offline PC games**.

- **Core Mission:** Unify achievement progress across disparate emulator save folders (Goldberg, GSE, CODEX, RUNE) into one unified local library, enriched with official Steam Web API metadata (names, descriptions, icons, global rarity percentages, store details, Metacritic, and review sentiment).
- **Offline First:** After initial sync and image caching, the app functions 100% offline. Local SQLite is the single source of truth.
- **Brand Personality & North Star:** *"The Trophy Case"*. Dark Steam-adjacent chrome with PlayStation-inspired trophy metals (Bronze, Silver, Gold, Platinum). Celebration is earned through tier colors, completion rings, and unlock presentation — **not** through SaaS dashboard tropes, gambling neon, or bare spreadsheet utility.
- **Key References:**
  - [PRODUCT.md](file:///c:/Users/Luky/Documents/Github/AchieveMe/AchieveMe/PRODUCT.md) — Product requirements, positioning, audience, and principles.
  - [DESIGN.md](file:///c:/Users/Luky/Documents/Github/AchieveMe/AchieveMe/DESIGN.md) — Canonical design system, color tokens, typography, components, and strict Do's & Don'ts.
  - [CLEANUP_PLAN.md](file:///c:/Users/Luky/Documents/Github/AchieveMe/AchieveMe/CLEANUP_PLAN.md) — Architectural refactoring roadmap for main-process IPC handlers and dead code pruning.

---

## 2. Workspace & Monorepo Structure

```
AchieveMe/
├── achieveme/                  # Core Electron application
│   ├── electron/               # Electron builder & dev config
│   ├── resources/              # Bundled assets (DepotDownloader binaries, etc.)
│   ├── src/
│   │   ├── assets/             # Sound files, icons, static assets
│   │   ├── main/               # Electron Main process (Backend, SQLite, Services)
│   │   │   ├── achievement/    # Discovery, parsers, watchers, steam API, tools, playtime
│   │   │   │   ├── parsers/    # Format-specific save parsers (JSON, INI)
│   │   │   │   └── writers/    # Save write-back implementations
│   │   │   ├── db/             # SQLite connection (database.ts), schema (schema.ts), repository.ts
│   │   │   ├── ipc/            # IPC registration and bridge handlers (handlers.ts)
│   │   │   ├── index.ts        # Main process entry point & window lifecycle
│   │   │   ├── settings.ts     # AppSettings persistence (settings.json in userData)
│   │   │   ├── singleInstance.ts # Single-instance lock handling
│   │   │   └── trayService.ts  # System tray icon, minimize-to-tray, quit handlers
│   │   ├── preload/            # Preload script exposing window.api (contextBridge)
│   │   │   └── index.ts
│   │   ├── renderer/           # React 18 frontend (Vite)
│   │   │   └── src/
│   │   │       ├── components/ # Modals, chrome chips, docks, toasts, wizards
│   │   │       ├── hooks/      # React hooks (useLongPress, etc.)
│   │   │       ├── lib/        # In-app help copy, storage helpers, navigation
│   │   │       ├── pages/      # Dashboard, Library, GameDetail, News, Tools, Settings, Help
│   │   │       ├── toast/      # Dedicated renderer for the floating unlock toast window
│   │   │       ├── App.tsx     # App shell, routing state, transfer docks, boot splash
│   │   │       └── index.css   # Canonical design system CSS (140KB+ design tokens & utilities)
│   │   └── shared/             # Pure TypeScript contracts shared between main, preload, and renderer
│   │       ├── types.ts        # Central interfaces (Game, Achievement, AppSettings, etc.)
│   │       └── *Utils.ts       # Pure calculation, classification, and formatting helpers
│   └── tests/                  # 70+ test suites (500+ unit tests using node:test)
├── cloud-saves-worker/         # Cloudflare Worker for R2 cloud save storage & presigned URLs
│   ├── src/                    # Worker auth, contract, presigning, and retention logic
│   └── wrangler.toml           # Worker deployment config
├── ManifestChecker/            # C# .NET 8 console tool using SteamKit2
│   └── Program.cs              # Anonymous Steam PICS manifest checking for update detection
├── goldberg-files/             # Goldberg SteamEmu generator & regular release DLLs
├── plans/                      # Historical architectural blueprint and roadmap docs
└── LuaTools.py                 # Reference Python script for game download/setup operations
```

---

## 3. Core Technical Subsystems

### 3.1. Emulator Save Discovery & Watching
- **Supported Sources:**
  - **Goldberg:** `%APPDATA%\Goldberg SteamEmu Saves\{AppID}\achievements.json` (read + write-back).
  - **GSE:** `%APPDATA%\GSE Saves\{AppID}\achievements.json` (read + write-back).
  - **CODEX:** `%PUBLIC%\Documents\Steam\CODEX\{AppID}\achievements.ini` (read-only).
  - **RUNE:** `%PUBLIC%\Documents\Steam\RUNE\{AppID}\achievements.ini` (read-only).
- **Save Watcher (`watcherService.ts`):** Uses `chokidar` to monitor configured root folders. Debounces per AppID, reparses saves via `parsers/`, detects new unlocks, diffs against SQLite, triggers unlock notifications, and updates `profile_stats.json`.
- **Ignored AppIDs (`ignored_appids` table):** Deleting a game from the library records its AppID so leftover read-only saves (CODEX/RUNE) do not resurrect the game on the next refresh. Adding a game manually or via scan clears the ignore.

### 3.2. Steam Web API & Metadata Pipeline
- **API Key:** User configures their key in Settings (`steamApiKey`).
- **Catalog Authority (`steamApiClient.ts`):** Steam Web API `GetSchemaForGame` is the source of truth for achievements (names, descriptions, icons, hidden state). Saves only supply unlock status (`earned`, `earned_time`, `progress`, `max_progress`).
- **Rarities & Metacritic/Reviews:** `GetGlobalAchievementPercentagesForApp` calculates trophy tiers (LuDownloader tier math: Gold `< 20%`, Silver `20–40%`, Bronze `> 40%`). Store details API populates Metacritic scores and review sentiments.
- **Image Caching & Custom Protocol (`imageCacheService.ts`, `imageCacheProtocol.ts`):** Cover art, hero banners, and achievement icons are downloaded to `%APPDATA%\achieveme\images\{appid}\...` and rendered in the frontend via the custom privileged scheme `achieveme-img://`.

### 3.3. Local Database & State Persistence
- **Engine:** `better-sqlite3` operating on `%APPDATA%\achieveme\achieveme.db`.
- **Schema Management (`db/schema.ts`):** Migrations must be non-destructive. Always check column presence via `PRAGMA table_info` before executing `ALTER TABLE ADD COLUMN`.
- **Repository Pattern (`db/repository.ts`):** Encapsulates all SQL transactions for games, achievements, API caches, playtime history, and wanted games.
- **Fast Dashboard Cache (`profileStatsService.ts`):** Materialized summary cached in `profile_stats.json` inside userData for near-instant dashboard loading.

### 3.4. Playtime Tracking & Game Launching
- **Game Launch (`gameLaunchService.ts`):** Launches configured game executables with optional launch arguments. If UAC elevation is needed, falls back gracefully to `ShellExecute`.
- **Process Polling (`playtimeService.ts`):** Polls every ~2 seconds using PID tracking, `Get-Process` image names, and install directory tree matching. Flushes session seconds every ~30s.
- **Session Recap (`sessionRecapService.ts`):** When a play session exceeding 30 seconds ends, displays a session recap modal showing time played, unlocks earned during the window, and XP gained.

### 3.5. Unlock Notifications & Audio
- **Overlay Window (`unlockToastWindow.ts`):** A transparent, click-through, always-on-top Electron window positioned at the top-center of the screen.
- **Hydra-Style Animation:** Centered icon hold (~0.5s) → expand with title/description + XP → hold (~4s) → contract to icon → fade up.
- **Dynamic Width & Rarity Glow:** Width adapts to measured text content. Borders and glows reflect trophy tier (Bronze, Silver, Gold, or Lilac Platinum for 100% completion).
- **Audio Chime (`unlockSoundUtils.ts`):** Plays default Windows notify chime or custom `.wav`/`.mp3` with a 0–100% volume gain curve. Consecutive unlocks queue sequentially, each playing its own chime.

### 3.6. Backups & Cloud Sync
- **Local Backups (Ludusavi):** Integrates with external `ludusavi.exe` CLI. Synchronizes game titles with Ludusavi's GUI config (`%APPDATA%\ludusavi\config.yaml`), retaining up to 5 full snapshots per game.
- **Cloud Sync (`r2CloudSaveService.ts`):** Syncs with Cloudflare Worker (`cloud-saves-worker/`) backed by Cloudflare R2 storage via presigned URLs and Bearer authentication.

### 3.7. Modding & Utility Wizards
- **Steamless (`steamlessService.ts`):** Integrates with user-linked `Steamless.CLI.exe` to unpack SteamStub DRM from game executables.
- **Depot Downloader (`depotRunnerService.ts`):** Uses bundled `DepotDownloader.dll` and Hubcap API manifests to download game files and depots. Tracks active downloads across navigation in the persistent `TransfersDock`.
- **Manifest Checker (`manifestCheckerService.ts`):** Runs the C# `ManifestChecker` binary to anonymously query Steam PICS and detect game updates against stored depot GIDs.
- **Goldberg Setup (`goldbergSetupService.ts`):** Generates emulator configurations and installs/replaces `steam_api(64).dll` with `.bak` safety copies. Supports Denuvo offline activation preservation (`configs.*.ini`).

---

## 4. Strict Design System Guidelines (from `DESIGN.md`)

Agents modifying or adding UI components **must unconditionally follow** the rules codified in `DESIGN.md`:

1. **Two Canonical Layers:**
   - **App Shell (Library Chrome):** Canonical for Library, Dashboard, Settings, News, Tools, and Help. Built on `.library`, `.library-chrome`, and `.library-chip`. Pure-black canvas (`oklch(0% 0 0)`), flush chrome header, and Rajdhani uppercase matte pill navigation.
   - **Trophy / Hero Layer:** Canonical for Game Detail only. Bebas Neue game title clamp, frosted pills with backdrop blur over cover art, tier-tinted achievement rows, and completion rings.
2. **Colors & Theming:**
   - App Canvas: `oklch(0% 0 0)` (Pure black).
   - Surfaces: Shell base `oklch(15% 0.012 275)` (`--bg-base`), Surface 1–3 (`oklch(18–28% 0.014–0.018 275)`).
   - Progress Blue (`oklch(60% 0.12 230)` / `--color-progress`): Functional progress UI, rings, and active nav chips.
   - Action Blue (`oklch(62% 0.14 230)` / `--color-action`): Keyboard focus rings only — **never** as resting button fill or border.
   - Trophy Metals: Bronze, Silver, Gold, Platinum — used **only** when earned or for tier filtering ("The Metals Mean Earned Rule").
3. **Typography:**
   - Display: Bebas Neue — **reserved exclusively for game titles on game detail hero**. Never use on buttons, chips, nav labels, or list rows.
   - Stats / Pills / Chips: Rajdhani 500–700 uppercase with `0.04em` tracking.
   - Body & UI: System UI stack (`-apple-system`, Segoe UI, Roboto).
4. **Forbidden Patterns:**
   - **NO** legacy `app-nav` / `app-nav__link` (deprecated).
   - **NO** hardcoded hex colors (e.g. `#1a1a22`, `#5865f2`). Always use CSS custom properties.
   - **NO** generic SaaS cards, cream backgrounds, or hero-metric templates.
   - **NO** RGB-neon gradients or loot-box animations.
   - **NO** rectangular `button` tags where `library-chip` pills belong on app pages.
   - **NO** side-stripe border accents (`border-left > 1px`). Use full tinted borders with `color-mix`.
   - **NO** backdrop blur on standard lists — backdrop filter is allowed only over cover photography.

---

## 5. Architectural Invariants & Agent Rules

1. **Strict Process Isolation:**
   - **Main process** handles Node.js built-ins (`fs`, `path`, `child_process`), SQLite, network requests, and OS integration.
   - **Renderer process** is pure React. **NEVER** import Node.js built-ins or main process modules into renderer code.
   - All communication must cross the typed IPC boundary defined in `preload/index.ts` and `shared/types.ts`.
2. **Database Integrity:**
   - Never write raw SQL queries directly in IPC handlers. Use or extend functions in `src/main/db/repository.ts`.
   - Never drop or alter existing columns destructively. Migrations in `schema.ts` must use conditional checks.
3. **IPC Input Validation:**
   - Always sanitize and validate IPC parameters at the boundary (`String(x || '').trim()`, numeric checks, etc.).
   - Avoid redundant internal re-wrapping of already cleaned variables.
4. **Single-Instance Safety:**
   - Electron acquires a single-instance lock on `%APPDATA%\achieveme`.
   - When running tests or dev servers, ensure previous zombie processes are terminated so SQLite is not locked.
5. **Non-Blocking UI:**
   - Heavy operations (Steam scraping, Depot downloads, folder walking, boot warm) must run asynchronously in the main process with progress events dispatched to the renderer.

---

## 6. Development, Testing & Verification Workflows

All commands are executed from the `achieveme/` directory:

### Running Tests
The project uses the Node.js native test runner (`node:test`) with TypeScript stripping:
```bash
cd achieveme
npm test
```
*Current baseline:* **513 / 513 tests passing.** Any changes you make **must** keep the entire test suite green.

To run a specific test file or grep for a pattern:
```bash
# Run a specific test
node --experimental-strip-types --test tests/settings.test.mjs

# Filter tests by name
npm test -- --test-name-pattern="ludusavi"
```

### Typechecking
Run both Node (main/preload) and Web (renderer) TypeScript checks:
```bash
cd achieveme
npm run typecheck
```
Both `typecheck:node` and `typecheck:web` must pass with zero errors.

### Linting
```bash
cd achieveme
npm run lint
```

### Dev Mode
```bash
cd achieveme
npm run dev
```

### Building & Packaging
```bash
cd achieveme
npm run build
```
Builds the production bundle and generates Windows NSIS setup installer and portable executable in `achieveme/release/`.

### Cloud Saves Worker
```bash
cd cloud-saves-worker
npm install
npx wrangler dev
```

### ManifestChecker
```bash
cd ManifestChecker
dotnet build
dotnet run -- 730
```

---

## 7. Common Gotchas & Troubleshooting

- **SQLite Database Locked / Chromium Cache Access Denied:**
  If you see errors like `Unable to move the cache: Access is denied` or database lock errors, an orphaned `AchieveMe.exe` or `electron.exe` is still running. Exit AchieveMe from the system tray or terminate it via Task Manager / PowerShell (`Stop-Process -Name electron -Force`), then relaunch.
- **ESM vs CJS in Tests:**
  Tests are ESM `.test.mjs` files. When importing shared utilities into test files, ensure they do not accidentally pull in Node-only main process modules that break in standard runner contexts.
- **Windows Path Formatting:**
  Always use `path.normalize()`, `path.join()`, or lowercase comparisons when matching Windows drive letters and paths (e.g., `c:\` vs `C:\`).
- **Ludusavi GUI Title Encoding:**
  Ludusavi encodes special characters in folder names with underscores (e.g. `Onimusha: Way of the Sword` -> `Onimusha_ Way of the Sword`). Use `shared/ludusaviApiUtils.ts` helpers when resolving local backup paths.
