---
name: AchieveMe
description: Dark Steam-adjacent shell with PlayStation-inspired trophy metals and showcase-ready progress presentation.
colors:
  bg-base: "oklch(15% 0.012 275)"
  surface-1: "oklch(18% 0.014 275)"
  surface-2: "oklch(22% 0.016 275)"
  surface-3: "oklch(28% 0.018 275)"
  border-subtle: "oklch(34% 0.02 275)"
  ink: "oklch(93% 0.01 275)"
  ink-muted: "oklch(70% 0.014 275)"
  ink-subtle: "oklch(58% 0.012 275)"
  tier-bronze: "oklch(62% 0.13 58)"
  tier-silver: "oklch(76% 0.025 260)"
  tier-gold: "oklch(78% 0.15 88)"
  tier-platinum: "oklch(84% 0.07 285)"
  color-progress: "oklch(60% 0.12 230)"
  color-action: "oklch(62% 0.14 230)"
  color-error: "oklch(68% 0.16 25)"
typography:
  display:
    fontFamily: "'Bebas Neue', 'Franklin Gothic Medium', 'Arial Narrow', sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.03em"
  stats:
    fontFamily: "'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.04em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
components:
  button-default:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-default-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  chip-filter:
    backgroundColor: "oklch(16% 0.014 275 / 0.88)"
    textColor: "{colors.ink-muted}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-filter-active:
    backgroundColor: "oklch(22% 0.014 275 / 0.92)"
    textColor: "{colors.ink}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-hero:
    backgroundColor: "oklch(12% 0.014 275 / 0.72)"
    textColor: "{colors.ink-muted}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

# Design System: AchieveMe

## Overview

**Creative North Star: "The Trophy Case"**

AchieveMe is a late-night desktop companion: the Steam client is open, the room is dim, and the user is checking what they have left to platinum. The interface should feel like familiar dark gaming chrome with a trophy shelf inside it — progress you earned, metals that mean something, completion rings that read at a glance. Celebration comes from tier color and earned-state tinting, not from neon flash or loot-box motion.

The canonical visual system lives in `achieveme/src/renderer/src/index.css` and is fully implemented on **Game Detail**. Library, Dashboard, and Settings still use legacy inline styles (`#5865f2` accent, hardcoded grays) and must be migrated to these tokens — do not treat the old purple buttons as source of truth.

**Key Characteristics:**

- Hue-275 tinted dark neutrals for the shell; trophy metals (bronze, silver, gold, platinum) carry identity
- Bebas Neue for game titles only; Rajdhani for stats, filters, and chips; system UI for lists and body
- Frosted pill chips on cover art (hero nav) and matte pill filters in the achievement toolbar
- Tier-tinted earned rows with full borders — never side-stripe accents
- Restrained progress blue for rings and bars; accent blue for focus rings only, not decorative outlines
- State-only motion (150–600ms ease-out); reduced-motion alternatives required

## Colors

A cool violet-tinted dark shell (hue 275) with a full trophy-metal palette for earned celebration and tier filtering.

### Primary

- **Progress Blue** (`oklch(60% 0.12 230)` / `--color-progress`): Completion ring stroke, hero progress bar fill, primary progress affordances. The functional accent — where the user is in a game.
- **Action Blue** (`oklch(62% 0.14 230)` / `--color-action`): Keyboard focus rings only. Never used as a resting button fill or decorative outline.

### Tertiary

- **Trophy Bronze** (`oklch(62% 0.13 58)` / `--tier-bronze`): Bronze tier labels, earned-row tints, active filter chip border.
- **Trophy Silver** (`oklch(76% 0.025 260)` / `--tier-silver`): Silver tier role — same usage pattern as bronze.
- **Trophy Gold** (`oklch(78% 0.15 88)` / `--tier-gold`): Gold tier role — same usage pattern.
- **Trophy Platinum** (`oklch(84% 0.07 285)` / `--tier-platinum`): Platinum ring stroke, platinum badge, platinum row and filter states.

### Neutral

- **Shell Base** (`oklch(15% 0.012 275)` / `--bg-base`): App background, body default.
- **Surface 1–3** (`oklch(18–28% 0.014–0.018 275)`): Elevated panels, buttons, row backgrounds, nav bar.
- **Border Subtle** (`oklch(34% 0.02 275)`): Default borders on buttons, rows, dividers.
- **Ink** (`oklch(93% 0.01 275)`): Primary text on dark surfaces.
- **Ink Muted** (`oklch(70% 0.014 275)`): Descriptions, meta, inactive chip text — must stay ≥4.5:1 on row surfaces.
- **Ink Subtle** (`oklch(58% 0.012 275)`): Timestamps, rarity footnotes, placeholder descriptions.
- **Error** (`oklch(68% 0.16 25)` / `--color-error`): Error banners and destructive emphasis (delete mode).

### Named Rules

**The Metals Mean Earned Rule.** Trophy metal colors appear on earned achievements, tier filter active states, and completion celebration — never as generic decoration on inactive chrome.

**The One Accent Rule.** Progress blue carries functional progress UI. Action blue is focus-only. Do not reintroduce Discord-purple (`#5865f2`) or blue-outlined ghost buttons on product surfaces.

## Typography

**Display Font:** Bebas Neue (with Franklin Gothic Medium, Arial Narrow fallbacks)  
**Stats Font:** Rajdhani 500–700 (with system UI fallbacks)  
**Body / UI Font:** System UI stack (`-apple-system`, Segoe UI, Roboto)

**Character:** Condensed display authority for game names; technical-stats energy for counts, filters, and rings; readable system sans for achievement lists. Display fonts never appear on buttons, labels, or data tables.

### Hierarchy

- **Display** (400, `clamp(2.5rem, 5vw, 4rem)`, line-height 0.95): Game title on detail hero only. `text-wrap: balance`; max clamp ceiling 4rem (~64px).
- **Stats strong** (600, 1.25rem, tabular nums): Unlocked/total counts beside completion ring.
- **Stats label** (500, 0.75rem, uppercase 0.06em tracking): "ACHIEVEMENTS" meta under ring.
- **Filter / chip** (600, 0.75rem, uppercase 0.04em tracking, Rajdhani): Tier filter pills, hero pills, tier section headers.
- **Body** (400–600, 13px, line-height 1.45): Achievement names, toolbar section titles, app nav.
- **Caption** (400, 10–11px): Rarity percentages, unlock dates, hidden tags.

### Named Rules

**The Display Boundary Rule.** Bebas Neue is reserved for game titles on the detail hero. Everything interactive uses Rajdhani or system UI.

## Elevation

Flat-by-default with **tonal layering** — depth comes from surface steps (`--bg-base` → `--surface-3`) and translucent overlays on cover art, not drop shadows.

Hero cover uses a fixed full-bleed backdrop with a vertical gradient overlay (`oklch(10% 0.02 275 / 0.82)` → `0.94`) so text and pills stay readable. Hero pills add `backdrop-filter: blur(10px)` — purposeful glass on cover art only, not a global card style.

Earned achievement rows use `color-mix` tints at 12–16% tier color into a dark translucent base — celebration through hue, not lift.

Progress ring and bar fills animate once on load (600ms ease-out); static under `prefers-reduced-motion: reduce`.

### Named Rules

**The Cover Glass Rule.** Backdrop blur is allowed on hero pills over game art. Nowhere else unless the surface is literally over a photograph.

**The Flat Row Rule.** Achievement rows do not use box-shadow at rest. Icon wraps on earned rows may use a 1px tier-colored ring via `box-shadow: 0 0 0 1px`.

## Components

Character line for the system: **restrained gaming chrome with trophy-metal pride**.

### Buttons

- **Shape:** 6px radius (`--radius-sm`) for app-shell buttons; 999px pills for game-detail chips and filters.
- **Default:** `--surface-2` fill, `--ink` text, `--border-subtle` border, 6×14px padding, 13px system font.
- **Hover:** `--surface-3` fill; 150ms ease-out.
- **Focus:** 2px `--color-action` outline, 2px offset — all interactive elements.
- **Disabled:** 55% opacity, `not-allowed` cursor (hero refresh while loading).

### Chips / Filters

- **Style:** Rajdhani uppercase pill, matte dark translucent fill, subtle border, optional count badge (`oklch(100% 0 0 / 0.08)` background).
- **Inactive:** `--ink-muted` text.
- **Hover:** Lighter surface, `--ink` text.
- **Active (tier):** Tier-color `color-mix` at ~18% into base; tier-colored border at ~45%.
- **Active (hidden toggle):** Neutral lift only — no accent blue; same pill vocabulary as tier filters.
- **Hero pill variant:** Slightly more transparent base (`oklch(12% … / 0.72)`), backdrop blur; back button uses sentence case ("← Library").

### Cards / Containers

- **Achievement row:** 8px radius, full border, flex row (icon 40px + body + aside). Earned: tier-tinted background; unearned: `--surface-1` or translucent dark on detail page.
- **Tier header:** List divider with Rajdhani uppercase tier name in tier color + earned count meta.
- **Error / empty:** `--surface-1` panel, `--radius-md`, muted or error-colored text.

### Navigation

- **App nav** (Library/Dashboard/Settings): `--surface-1` bar, bottom border, text buttons with weight 700 for active page.
- **Game detail:** No app nav — hero bar with back + refresh pills over cover. Full-bleed `app-shell--game-detail`.

### Signature Components

**Completion ring** (SVG, 56px default / 96px hero): Track at 18% white on hero; fill `--color-progress` or `--tier-platinum`; Rajdhani tabular percent label.

**Platinum row** (synthetic): ✦ icon, dashed border when locked, "App exclusive" rarity.

**Game detail backdrop:** Cover or library hero image, fixed inset, non-interactive; content scrolls above.

## Do's and Don'ts

Concrete guardrails for agents extending AchieveMe UI.

### Do:

- **Do** use CSS custom properties from `:root` for all new surfaces — never hardcode `#1a1a22` or `#5865f2` on migrated pages.
- **Do** use Rajdhani uppercase pills for filters, sort controls, and hero actions on game surfaces.
- **Do** tint earned achievement rows with `color-mix(in oklch, var(--tier-*) …)` and full borders.
- **Do** keep body text and placeholders at `--ink-muted` or darker on tinted near-dark backgrounds.
- **Do** provide `@media (prefers-reduced-motion: reduce)` alternatives for bar fills, ring transitions, and skeleton pulse.
- **Do** cap hero display type at `clamp(…, 4rem)` and use `text-wrap: balance` on game titles.

### Don't:

- **Don't** use generic SaaS dashboard patterns: cream backgrounds, identical card grids, eyebrow kickers, hero-metric templates.
- **Don't** use gambling or RGB-neon aesthetics: flashy gradients, loot-box energy, overstimulating motion.
- **Don't** ship bare spreadsheet utility: raw tables with zero personality and no earned celebration.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on rows or cards — use full border tints instead.
- **Don't** use gradient text (`background-clip: text`) for emphasis.
- **Don't** use blue accent outlines on resting buttons — the hidden-description toggle is a neutral pill, not an action button.
- **Don't** apply Bebas Neue to buttons, nav labels, or achievement list items.
- **Don't** use decorative glassmorphism on list rows or library cards — blur is for hero pills on photography only.
