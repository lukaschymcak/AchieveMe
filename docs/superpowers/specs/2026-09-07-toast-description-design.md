# Unlock Toast Description — Design

**Date:** 2026-09-07  
**Status:** Approved (Approach A)

## Goal

Show achievement description on the unlock toast, make the overlay longer, and drop only the `UNLOCKED!` eyebrow. Keep the XP pill and rarity chrome.

## Layout (expanded)

Left to right: **icon (72px)** | text column. Text column top to bottom:

1. **Trophy / achievement name** (bold, prominent)
2. **Description** (brighter, readable, up to 2 lines)

XP `+N` pill stays top-right. No game name line. No eyebrow / `UNLOCKED!` label.

Platinum celebration: `All achievements unlocked` as the trophy line; no description node when empty.

## Window size

Overlay grows from `387×97` to **`520×120`**. Icon-hold → expand / shrink animation timing stays the same.

## Data

- Add `description: string` to `UnlockChange` and `UnlockToastPayload`
- `diffAchievements` copies `Achievement.description` onto each unlock
- `notifyUnlocks` passes it through; empty string → renderer omits the description element
- Settings preview cycles short / medium / long description samples

## Motion / a11y

Description joins the enter stagger and exit text fade with the trophy name. `aria-label` includes achievement and game when present.

## Out of scope

Detail toast / keybind, icon warm await, XP value changes, rarity border redesign.
