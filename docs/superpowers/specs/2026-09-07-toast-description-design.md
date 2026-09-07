# Unlock Toast Description — Design

**Date:** 2026-09-07  
**Status:** Approved (Approach A)

## Goal

Show achievement description on the unlock toast, make the overlay longer, and drop only the `UNLOCKED!` eyebrow. Keep the XP pill and rarity chrome.

## Layout (expanded)

Left to right: **icon (57px)** | text column. Text column top to bottom:

1. **Game name** (muted)
2. **Trophy / achievement name** (strong)
3. **Description** (muted, up to 2 lines, ellipsis)

XP `+N` pill stays top-right. No eyebrow / `UNLOCKED!` / `Platinum!` label.

Platinum celebration: game name + `All achievements unlocked` as the trophy line; no description node when empty.

## Window size

Overlay grows from `387×97` to **`520×120`**. Icon-hold → expand / shrink animation timing stays the same.

## Data

- Add `description: string` to `UnlockChange` and `UnlockToastPayload`
- `diffAchievements` copies `Achievement.description` onto each unlock
- `notifyUnlocks` passes it through; empty string → renderer omits the description element
- Settings preview includes a sample game name and sample description

## Motion / a11y

Description joins the enter stagger and exit text fade with game + name. `aria-label` includes achievement and game when present.

## Out of scope

Detail toast / keybind, icon warm await, XP value changes, rarity border redesign.
