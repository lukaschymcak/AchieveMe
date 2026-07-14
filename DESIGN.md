---
name: AchieveMe
description: Dark Steam-adjacent shell with PlayStation-inspired trophy metals and showcase-ready progress presentation.
colors:
  bg-base: "oklch(15% 0.012 275)"
  canvas-black: "oklch(0% 0 0)"
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
  chip-app:
    backgroundColor: "oklch(16% 0.014 275 / 0.88)"
    textColor: "{colors.ink-muted}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-app-active:
    backgroundColor: "oklch(22% 0.014 275 / 0.92)"
    textColor: "{colors.ink}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-app-nav-active:
    backgroundColor: "color-mix(in oklch, {colors.color-progress} 14%, oklch(16% 0.014 275 / 0.92))"
    textColor: "{colors.ink}"
    typography: "{typography.stats}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
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
  input-chrome-search:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
---

# Design System: AchieveMe

## Overview

**Creative North Star: "The Trophy Case"**

AchieveMe is a late-night desktop companion: the Steam client is open, the room is dim, and the user is checking what they have left to platinum. The interface should feel like familiar dark gaming chrome with a trophy shelf inside it — progress you earned, metals that mean something, completion rings that read at a glance. Celebration comes from tier color and earned-state tinting, not from neon flash or loot-box motion.

The visual system has **two canonical layers**, each with a reference implementation in `achieveme/src/renderer/src/index.css`:

1. **App shell (Library chrome)** — canonical for **Library, Dashboard, Settings, and Help**. Implemented on `LibraryPage` via `.library`, `.library-chrome`, `.library-chip`, and `.library-chrome__search`. Pure-black canvas, embedded Rajdhani pill navigation, matte chip actions, chrome header with bottom border. This is the furniture every app page must share.
2. **Trophy / hero surfaces (Game Detail)** — canonical for **game detail only**. Bebas game titles, frosted hero pills over cover art, tier-tinted achievement rows, completion rings, tier filter bar.

**Migration status:** Library is the reference app shell. Dashboard, Settings, and Help still render inside the legacy `app-nav` top bar and page-specific form layouts — they must migrate onto Library chrome, not invent a third pattern. Game Detail is complete. Do not treat `#5865f2`, `#1a1a22`, or `app-nav` as source of truth.

**Key Characteristics:**

- Pure-black app canvas (`oklch(0% 0 0)`) on Library and all pages that adopt its shell; hue-275 tinted neutrals for panels and game surfaces
- Rajdhani uppercase matte pills (`library-chip`) for app navigation, sort/filter, and primary actions on app pages
- Bebas Neue for game titles on detail hero only; system UI for achievement lists and form body copy
- Frosted pill chips on cover art (hero nav) and matte pill filters in the achievement toolbar
- Tier-tinted earned rows with full borders — never side-stripe accents
- Restrained progress blue for rings, bars, and active nav chip tint; action blue for focus rings only
- State-only motion (150–600ms ease-out); reduced-motion alternatives required

## Colors

A cool violet-tinted dark shell (hue 275) with a full trophy-metal palette for earned celebration and tier filtering. App pages sit on a **pure-black canvas** distinct from `--bg-base`.

### Primary

- **Progress Blue** (`oklch(60% 0.12 230)` / `--color-progress`): Completion ring stroke, hero progress bar fill, active app-nav chip tint (`library-chip--nav.library-chip--active`), text links (`library__link-btn`). The functional accent — where the user is in a game or which app page is current.
- **Action Blue** (`oklch(62% 0.14 230)` / `--color-action`): Keyboard focus rings only. Never used as a resting button fill or decorative outline.

### Tertiary

- **Trophy Bronze** (`oklch(62% 0.13 58)` / `--tier-bronze`): Bronze tier labels, earned-row tints, active filter chip border.
- **Trophy Silver** (`oklch(76% 0.025 260)` / `--tier-silver`): Silver tier role — same usage pattern as bronze.
- **Trophy Gold** (`oklch(78% 0.15 88)` / `--tier-gold`): Gold tier role — same usage pattern.
- **Trophy Platinum** (`oklch(84% 0.07 285)` / `--tier-platinum`): Platinum ring stroke, platinum badge, platinum row and filter states.

### Neutral

- **App Canvas** (`oklch(0% 0 0)` / `.library` background): Full-bleed black behind Library and all migrated app pages. Deeper than `--bg-base`; reads as gaming-client void.
- **Shell Base** (`oklch(15% 0.012 275)` / `--bg-base`): Body default, nested inputs, game-detail backdrop base.
- **Surface 1–3** (`oklch(18–28% 0.014–0.018 275)`): Elevated panels, search fields, empty states, row backgrounds.
- **Border Subtle** (`oklch(34% 0.02 275)`): Default borders on chips, rows, chrome dividers.
- **Ink** (`oklch(93% 0.01 275)`): Primary text on dark surfaces.
- **Ink Muted** (`oklch(70% 0.014 275)`): Descriptions, meta, inactive chip text — must stay ≥4.5:1 on row surfaces.
- **Ink Subtle** (`oklch(58% 0.012 275)`): Timestamps, rarity footnotes, chrome count labels, placeholders on dark panels.
- **Error** (`oklch(68% 0.16 25)` / `--color-error`): Error banners, destructive chip hover (`library-chip--danger`), delete mode.

### Named Rules

**The Metals Mean Earned Rule.** Trophy metal colors appear on earned achievements, tier filter active states, and completion celebration — never as generic decoration on inactive chrome.

**The One Accent Rule.** Progress blue carries functional progress UI and active app-page nav state. Action blue is focus-only. Do not reintroduce Discord-purple (`#5865f2`) or blue-outlined ghost buttons on product surfaces.

**The Black Canvas Rule.** App pages use `oklch(0% 0 0)` as the page background via `.library` (or a shared alias). Do not put Dashboard, Settings, or Help on `--bg-base` alone — the void black is part of the Library identity.

## Typography

**Display Font:** Bebas Neue (with Franklin Gothic Medium, Arial Narrow fallbacks)  
**Stats Font:** Rajdhani 500–700 (with system UI fallbacks)  
**Body / UI Font:** System UI stack (`-apple-system`, Segoe UI, Roboto)

**Character:** Condensed display authority for game names; technical-stats energy for app chrome, counts, filters, and rings; readable system sans for achievement lists and settings form copy. Display fonts never appear on app nav chips, buttons, or data tables.

### Hierarchy

- **Display** (400, `clamp(2.5rem, 5vw, 4rem)`, line-height 0.95): Game title on detail hero only. `text-wrap: balance`; max clamp ceiling 4rem (~64px).
- **Stats strong** (600, 1.25rem, tabular nums): Unlocked/total counts beside completion ring.
- **Stats label** (500, 0.75rem, uppercase 0.06em tracking): "ACHIEVEMENTS" meta under ring.
- **App chip / filter** (600, 0.75rem, uppercase 0.04em tracking, Rajdhani): `library-chip` nav, sort, refresh, tier filter pills, chrome count (`library-chrome__count`).
- **Body** (400–600, 13px, line-height 1.45): Achievement names, settings section copy, form labels.
- **Caption** (400, 10–11px): Rarity percentages, unlock dates, hidden tags, footer notes.

### Named Rules

**The Display Boundary Rule.** Bebas Neue is reserved for game titles on the detail hero. Everything interactive on app pages uses Rajdhani chips or system UI.

**The Chip Voice Rule.** App navigation, sort controls, and page-level actions speak in Rajdhani uppercase pills — not system-font rectangular buttons. Rectangular `button` defaults are legacy fallback only until pages migrate.

## Elevation

Flat-by-default with **tonal layering** — depth comes from surface steps (`--bg-base` → `--surface-3`) and translucent chip fills, not drop shadows.

**App chrome** uses a single bottom border on `.library-chrome` — no elevated nav bar, no `app-nav` strip. The header row is flush with the black canvas.

Hero cover uses a fixed full-bleed backdrop with a vertical gradient overlay (`oklch(10% 0.02 275 / 0.82)` → `0.94`) so text and pills stay readable. Hero pills add `backdrop-filter: blur(10px)` — purposeful glass on cover art only, not a global card style.

Earned achievement rows use `color-mix` tints at 12–16% tier color into a dark translucent base — celebration through hue, not lift.

Progress ring and bar fills animate once on load (600ms ease-out); static under `prefers-reduced-motion: reduce`.

### Named Rules

**The Cover Glass Rule.** Backdrop blur is allowed on hero pills over game art. Nowhere else unless the surface is literally over a photograph.

**The Flat Row Rule.** Achievement rows and library list rows do not use box-shadow at rest. Icon wraps on earned rows may use a 1px tier-colored ring via `box-shadow: 0 0 0 1px`.

**The Flush Chrome Rule.** App navigation lives inside `.library-chrome`, not a separate elevated `app-nav` bar. One header row, one bottom border, content below.

## Components

Character line for the system: **restrained gaming chrome with trophy-metal pride**.

### App page shell (Library chrome — canonical for Library, Dashboard, Settings, Help)

Reference: `LibraryPage.tsx` + `components/app/` (`AppShell`, `AppChrome`, `AppNav`, `Chip`, `AppSearchInput`, `AppToolbarButton`) + `.app-*` / `.library-*` classes in `index.css`.

- **Page wrapper** (`.library`): `display: flex; flex-direction: column; min-height: 100%`; padding `var(--space-4) clamp(var(--space-4), 3vw, var(--space-6))`; background `oklch(0% 0 0)`; font `var(--font-ui)`.
- **Chrome wrap** (`.library-chrome-wrap`): margin-bottom `var(--space-5)`; optional second-row toolbar (`.library-chrome__toolbar`) for icon actions.
- **Chrome header** (`.library-chrome`): flex row, align center, gap `var(--space-3)`, padding-bottom `var(--space-4)`, border-bottom `1px solid var(--border-subtle)`. Slots: left (nav + page tools), center (search flex), right (meta + actions).
- **Responsive:** wraps at 1100px (nav full width, search full width, right row below); sort divider drops at 640px.

### App chips (`library-chip`)

Matte Rajdhani uppercase pills — the **primary interactive vocabulary on app pages**.

- **Shape:** 999px radius, min-height 32px, padding 5×12px, `font-stats` 0.75rem / 600 / 0.04em tracking / uppercase.
- **Default:** `oklch(16% 0.014 275 / 0.88)` fill, `oklch(34% 0.02 275 / 0.45)` border, `--ink-muted` text.
- **Hover:** `oklch(20% … / 0.92)` fill, `--ink` text; 150ms ease-out.
- **Active** (`.library-chip--active`): `oklch(22% … / 0.92)` fill, `--ink` text, stronger border.
- **Nav active** (`.library-chip--nav.library-chip--active`): progress-blue tint at 14% into base; progress-blue border at 40%.
- **Action** (`.library-chip--action`): same chip shape for Refresh, Save, Export — not rectangular buttons.
- **Danger** (`.library-chip--danger`): error color on hover/active for destructive confirms.
- **Focus:** 2px `--color-action` outline, 2px offset.

### App chrome search (`library-chrome__search`)

Canonical text field for app pages (search, API key, folder path).

- **Shape:** full width, min-height 36px, padding `var(--space-2) var(--space-4)`, `--radius-sm`.
- **Default:** `--surface-1` fill, `--border-subtle` border, 13px system UI, `--ink` text.
- **Placeholder:** `--ink-muted`.
- **Hover:** `--surface-2` background.
- **Focus:** border `color-mix(action 55%, border-subtle)`, `--surface-2` background, 2px action outline.

### Icon toolbar (`library-view-toggle`)

32×32px square controls for secondary chrome actions (add game, grid/list). Same matte fill as chips, `--radius-sm`, not pills.

### Buttons (legacy fallback — deprecating on app pages)

- **Shape:** 6px radius (`--radius-sm`) for global `button` reset only.
- **Default:** `--surface-2` fill, `--ink` text, `--border-subtle` border, 6×14px padding, 13px system font.
- **Use on app pages:** avoid — prefer `library-chip`. Still acceptable inside unmigrated Settings form rows until extract/migration lands.

### Chips / Filters (Game Detail)

- **Style:** Rajdhani uppercase pill, matte dark translucent fill, subtle border, optional count badge (`oklch(100% 0 0 / 0.08)` background).
- **Inactive:** `--ink-muted` text.
- **Hover:** Lighter surface, `--ink` text.
- **Active (tier):** Tier-color `color-mix` at ~18% into base; tier-colored border at ~45%.
- **Active (hidden toggle):** Neutral lift only — no accent blue; same pill vocabulary as tier filters.
- **Hero pill variant:** Slightly more transparent base (`oklch(12% … / 0.72)`), backdrop blur; back button uses sentence case ("← Library").

### Cards / Containers

- **Library card / list row:** Full-width progress surfaces on black canvas; platinum tint variant; skeleton pulse for loading.
- **Achievement row:** 8px radius, full border, flex row (icon 40px + body + aside). Earned: tier-tinted background; unearned: `--surface-1` or translucent dark on detail page.
- **Settings / form panel:** `--surface-1` panel, `--radius-md`, full border — content inside app shell, not a separate document column on `--bg-base`.
- **Empty state** (`.library__status--empty`): centered panel, `--surface-1`, `--radius-md`, muted text.

### Navigation

- **App chrome nav (canonical):** `library-chip library-chip--nav` inside `.library-chrome__nav`. Pages: Dashboard, Library, Settings, Help. Active page gets `library-chip--active` + progress-blue nav tint. Embedded in page chrome — **not** a separate top bar.
- **Legacy `app-nav` (deprecated):** `--surface-1` strip with text `app-nav__link` buttons. Used only by unmigrated Dashboard / Settings / Help in `App.tsx`. **Do not extend.** Remove when those pages adopt `.library-chrome`.
- **Game detail:** No app chrome — hero bar with back + refresh pills over cover. Full-bleed `app-shell--game-detail`.

### Signature Components

**Completion ring** (SVG, 56px default / 96px hero): Track at 18% white on hero; fill `--color-progress` or `--tier-platinum`; Rajdhani tabular percent label.

**Platinum row** (synthetic): ✦ icon, dashed border when locked, "App exclusive" rarity.

**Game detail backdrop:** Cover or library hero image, fixed inset, non-interactive; content scrolls above.

**Help tip** (`.help-tip`): 18px circular `?` trigger; floating popover portal; `--surface-3` panel, `--ink` text.

## Do's and Don'ts

Concrete guardrails for agents extending AchieveMe UI.

### Do:

- **Do** use **Library chrome** (`.library` + `.library-chrome` + `.library-chip`) as the app shell for Dashboard, Settings, Help, and Library — extract shared components from `LibraryPage` when building new app surfaces.
- **Do** use CSS custom properties from `:root` for all surfaces — never hardcode `#1a1a22` or `#5865f2`.
- **Do** use `library-chip` for app navigation, page actions (Refresh, Save, Export), and sort/filter controls on app pages.
- **Do** use `library-chrome__search` styling for text inputs on app pages (search, API key, folder paths).
- **Do** use Rajdhani uppercase pills for tier filters and hero actions on game detail.
- **Do** tint earned achievement rows with `color-mix(in oklch, var(--tier-*) …)` and full borders.
- **Do** keep body text and placeholders at `--ink-muted` or darker on tinted near-dark backgrounds.
- **Do** provide `@media (prefers-reduced-motion: reduce)` alternatives for bar fills, ring transitions, and skeleton pulse.
- **Do** cap hero display type at `clamp(…, 4rem)` and use `text-wrap: balance` on game titles.

### Don't:

- **Don't** use or extend `app-nav` / `app-nav__link` on new work — it is deprecated in favor of `library-chrome` embedded nav.
- **Don't** put Dashboard, Settings, or Help on a separate shell from Library — one app chrome, slot-based page content.
- **Don't** use generic SaaS dashboard patterns: cream backgrounds, identical card grids, eyebrow kickers, hero-metric templates.
- **Don't** use gambling or RGB-neon aesthetics: flashy gradients, loot-box energy, overstimulating motion.
- **Don't** ship bare spreadsheet utility: raw tables with zero personality and no earned celebration.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on rows or cards — use full border tints instead.
- **Don't** use gradient text (`background-clip: text`) for emphasis.
- **Don't** use rectangular default `button` for primary actions on app pages when `library-chip` applies.
- **Don't** use blue accent outlines on resting buttons — chips and toggles use neutral matte fills at rest.
- **Don't** apply Bebas Neue to buttons, nav labels, or achievement list items.
- **Don't** use decorative glassmorphism on list rows or library cards — blur is for hero pills on photography only.
