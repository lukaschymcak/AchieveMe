# Reapply Goldberg — Design

**Date:** 2026-10-16  
**Status:** Approved

## Goal

From the game page, reapply the Goldberg emulator and choose whether achievements are included. The same choice appears when an update offers to reapply Goldberg.

## Decisions

| Decision | Choice |
|----------|--------|
| Entry | One **Reapply Goldberg** pill on the game page |
| Question | Include achievements? **Yes** or **No** |
| Yes | Current apply: emulator DLL, generator, `steam_settings`, seed if the save is missing |
| No | Emulator DLL plus `steam_appid.txt` only. No generator. No seed |
| DLL | Use the saved path when that file exists. Otherwise scan the install folder, then browse |
| Emulator DLL | Always installed on this path (`installEmuDll: true`) |
| Denuvo | Left false. No new Denuvo control |
| Existing achievement files | Not deleted. **No** only skips generating and seeding |
| Default on the question | **Yes** |

## Game page

Show **Reapply Goldberg** when the game has an install path. It replaces the **Set up achievements** pill that only appeared when `total_achievements === 0`.

Clicking it opens one dialog:

1. **Include achievements?** Yes / No. Cancel closes the dialog.
2. Resolve `steam_api.dll` or `steam_api64.dll`:
   - `games.goldberg_dll_path` when that file exists
   - otherwise `depotScanDll(install_path)`
   - otherwise a path field and **Browse…** (`browseDllPath`). Apply stays disabled until a DLL is chosen
3. Run apply. Show the Goldberg log in the dialog. On failure, show the error and leave the dialog open. On success, close it and refresh the game.

The Add Game wizard and the post-download **Set up achievements** prompt stay as they are.

## Update reapply

On the update transfer **Reapply tools** step, when Goldberg is checked, show **Include achievements?** as Yes / No on that same panel. Default **Yes**. It is not a second dialog. The DLL field already on that step is the path that gets applied. Steamless is unchanged.

## Main process

Add `includeAchievements: boolean` to `GoldbergApplyRequest`.

`applyGoldberg`:

- `true`: keep the current catalog fetch, `goldbergSetupSteps`, generator or minimal settings, and seed.
- `false`: do not fetch the catalog, do not run the generator, do not seed. Call `writeMinimalSteamSettings`. Still install the emulator DLL when `installEmuDll` is true, then `processAppId` and `saveGameToolApply` as today.

`writeMinimalSteamSettings` still only writes `steam_appid.txt`. It does not remove `achievements.json` or the AppData save.

## Errors

- Missing Goldberg release DLL, a bad AppID, or a generator failure reject the IPC call. The dialog shows that message.
- `goldberg_applied` is saved only after apply finishes, which is already the case.
- Cancelling the file browse leaves the dialog on the DLL step.

## Tests

- A pure helper: `includeAchievements: false` forces skip-generator and no seed even when the catalog is non-empty. `true` keeps `goldbergSetupSteps`.
- A pure helper: show **Reapply Goldberg** when the install path is non-empty, including when `total_achievements > 0`. Hide it when the install path is empty.

## Out of scope

Restore-from-`.bak`, stripping an existing `steam_settings` folder, a Denuvo toggle on this dialog, and changing Add Game or the depot-download setup prompt.
