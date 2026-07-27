# Game Detail Play Button — Design

**Date:** 2026-07-27  
**Status:** Approved

## Goal

Launch a game from game detail via Play next to the title, remembering a chosen executable.

## Behavior

- Persist absolute `launch_exe` on `games`
- Play: launch if valid; else list top-level `.exe` under `install_path`; else browse folder → list → pick → save → launch
- Chevron: Change executable (reopen list; browse folder first if no install path)

## Launch

`spawn` detached, cwd = exe directory. No CLI args.
