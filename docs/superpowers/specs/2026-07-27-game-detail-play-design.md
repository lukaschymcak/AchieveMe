# Game Detail Play Button — Design

**Date:** 2026-07-27  
**Status:** Approved (updated for game-root resolve)

## Goal

Launch a game from game detail via Play / Select exe next to the title, remembering a chosen executable.

## Behavior

- Persist absolute `launch_exe` on `games`
- Until `launch_exe` is set: **Set install folder** if `install_path` is empty, else **Select exe**
- Picking an exe saves `launch_exe` only (does not launch); **Play** launches afterward
- Resolve game root by walking up from `install_path` (often the steam DLL dir) until a folder name matches / is similar to the game name
- Confident match → recursive `.exe` list under that root → pick → save
- Unsure match (e.g. acronym folder) → ask “Is this the game’s folder?” → then list or browse
- No match / empty install path → browse folder → recursive list → pick
- Chevron: Change executable (same resolve flow)

## Launch

`spawn` detached, cwd = exe directory. No CLI args.
