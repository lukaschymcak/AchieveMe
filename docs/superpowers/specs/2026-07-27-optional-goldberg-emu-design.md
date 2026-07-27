# Optional Goldberg Emulator Install — Design

**Date:** 2026-07-27  
**Status:** Approved

## Goal

Extend Add Game so users can optionally install the Goldberg emulator DLL (regular build) while always keeping the existing `steam_settings` + achievements seed flow.

## Decisions

| Decision | Choice |
|----------|--------|
| Emu source | `goldberg-files/release/regular/{x64\|x86}` only |
| Default | Opt-in **off** |
| Backup | `steam_api(64).dll.bak`, overwrite existing `.bak` |
| UI | Dedicated wizard step `emu` between `dll` and `apply` |
| Copy | Plain question + short explanation |

## Wizard flow

`search` → `dll` → `emu` → `apply`

### Emu step

- Ask: “Also apply the Goldberg emulator?”
- Explain: Replaces the game’s Steam API DLL with Goldberg so the game runs through the emu. The original DLL is saved as `.bak` first.
- Default unchecked; Next always enabled.

## Main process

When `installEmuDll: true` on `GoldbergApplyRequest`:

1. Resolve release root (dev: `../goldberg-files/release`, packaged: `resources/goldberg_release`)
2. Resolve `regular/{arch}/steam_api(64).dll`
3. Fail early if source missing (before touching game DLL)
4. Copy current game DLL → `.bak` (overwrite)
5. Copy emu DLL over game DLL
6. Continue existing generator → `steam_settings` → seed → `processAppId`

When false: skip steps 1–5; behavior identical to today.

## Packaging

`electron-builder` `extraResources`: bundle `../goldberg-files/release/regular` → `goldberg_release/regular`.

## Out of scope

Experimental/steamclient builds, restore-from-bak UI, Settings defaults.
