# Scan Add selected → Hubcap GIDs (Windows + DLC) — Design

**Date:** 2026-09-07  
**Status:** Approved

## Goal

When the user clicks **Add selected** in Tools → Scan for installed games, AchieveMe writes `install_path` (and optional suggested `launch_exe`), then pulls Hubcap manifest GIDs for each selected AppID. Achievements are **never** auto-opened; the user runs **Set up achievements** from Game Detail when they want.

## Done when

1. Add selected upserts path/exe for every checked row (unchanged retain behavior).
2. Each selected AppID gets a Hubcap ZIP download + parse (existing `depotDownloadManifest` / `depotProcessZip`).
3. GIDs saved via existing `manifestSaveGids` / import path with `installPath` set.
4. Depot selection follows the classification rules below (auto vs picker queue).
5. No `AddGameModal` / Set up achievements opens from this flow.
6. Per-game Hubcap failures keep the library row + path and report an error; the batch continues.
7. Help + README describe the new behavior.

## Depot classification

Operate on Hubcap **content depots** (LUA `addappid` entries with a decryption key → `gameData.depots`). Manifest GIDs come from `gameData.manifests`.

Classify each depot by its **description** string (case-insensitive):

| Class | Rule | Action |
|---|---|---|
| **Drop** | Description clearly indicates Linux, macOS, OSX, or Mac (word-boundary style, same spirit as existing soundtrack blacklist) | Never auto-save; hide or disable in picker |
| **Auto-keep** | Description clearly indicates Windows, **or** clearly indicates DLC (e.g. `\bdlc\b` in description, or depot id appears in `gameData.dlcs` **and** has a manifest GID) | Include in saved GIDs without asking |
| **Unsure** | Everything else with a non-empty manifest GID | Requires user confirmation |

**DLC note:** Hubcap also lists keyless entries in `gameData.dlcs` (DLC AppIDs / names). Those are not content depots. Auto-keep only applies to **depot rows that have manifests**. Prefer description/`dlcs` membership as signals to treat a depot as DLC for auto-keep; do not invent GIDs for keyless DLC rows.

## Per-game decision

After classification for one AppID:

1. **No unsure depots** → save `pickManifestGids(manifests, autoKeepIds)` immediately (overwrite any prior `manifest_gids` for that AppID). If `autoKeepIds` is empty after drops, treat as Hubcap/import error for that game (do not save an empty GID map that clears useful prior data unless the user confirmed an empty picker — prefer fail-soft: skip GID write, keep path, show “no Windows/DLC depots found”).
2. **Any unsure depot** → enqueue a **depot picker** for that game. Pre-check auto-keep; leave unsure unchecked; do not offer dropped OS depots (or show them disabled). User confirms → save selected IDs that have GIDs.

## Queue UX

- Run path upsert + Hubcap fetch for all selected games first (sequential is fine).
- Games that auto-resolve finish silently (status text ok).
- Games that need a picker form a **queue**: show “Game *k* of *n*” with the existing checklist style (reuse Import/Depot depot list patterns; path is already known — no folder browse).
- Confirm advances to the next queued game; Cancel/Skip on one game skips GID write for that game only (path already saved) and continues the queue.
- Never open Set up achievements / Goldberg apply from this flow.

## Architecture

| Layer | Responsibility |
|---|---|
| Shared | Pure helpers: classify depot description → `drop` \| `auto-keep` \| `unsure`; pick Windows/DLC ids; unit-tested |
| Renderer (`InstalledGamesScanModal` + small queue picker, or inline phase) | Orchestrate import → Hubcap IPC → auto-save or enqueue picker; progress/errors |
| Existing IPC | `importScannedInstall`, `depotDownloadManifest`, `depotProcessZip`, `manifestSaveGids` (or `importExistingInstall` after path upsert — prefer `manifestSaveGids` once the row exists) |
| Main / Hubcap | Unchanged download + ZIP parse |

**Preferred orchestration:** renderer loop (Approach A). No new Hubcap client. Optional thin shared util only for classification + ID picking.

## Error handling

- Missing Hubcap key / network / 404: keep path row; surface per-appid error; continue batch.
- ZIP with no usable manifests: same.
- User dismisses scan modal mid-queue: abandon remaining picker items (already-auto-saved GIDs stay).

## Out of scope

- Auto-opening Set up achievements / `AddGameModal`
- Changing Depot Downloader or Import existing default selection rules
- Matching depots to on-disk folders
- Raising scan walk depth further (already 8)
- Non-Windows host OS support

## Validation (manual)

1. Scan a root with a known Windows-only title → Add selected → library has path + `manifest_gids`; no achievement modal.
2. Title with Linux + Windows depots in Hubcap → only Windows/DLC GIDs stored (or picker if unsure remain).
3. Title with ambiguous depot names → picker appears; queue works for two such titles in one Add selected.
4. Game Detail still shows Set up achievements when `total_achievements === 0`.
