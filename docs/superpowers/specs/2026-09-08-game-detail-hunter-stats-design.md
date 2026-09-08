# Game Detail hunter stats (Steam-only) — Design

**Date:** 2026-09-08  
**Status:** Approved (HLTB deferred — option A)  
**Parent:** `docs/superpowers/plans/2026-09-07-launcher-os-program.md` Workstream H  
**Child plan:** `docs/superpowers/plans/2026-09-08-game-detail-hunter-stats.md`

## Goal

Game Detail shows a fail-soft **hunter** strip with Steam Store-derived stats (Metacritic, recommendation count, review percent **only if present** in Store JSON). HowLongToBeat is **out of this child**.

## Done when

1. Opening Game Detail for a real Steam title asynchronously fills a strip under the hero with available Steam fields; missing pieces omitted.
2. Primary detail load (`get-game-detail`, covers, achievements, Play) is never blocked on hunter HTTP.
3. Stats cached in `api_cache` type `appdetails_stats` (1 day TTL); offline reopen uses stale/fresh cache; HTTP failure is silent (empty or stale).
4. Non-useful / Store-miss appids hide the strip — no error toast storm.
5. Shared cover pipeline stays untouched: `fetchAppDetails` keeps `filters=basic` and `api_cache` type `appdetails` `{ name, header_image }`.
6. Help + README document the strip; HLTB explicitly deferred.
7. `npm test` + `npm run typecheck` green; cover regression tests exist.

## Locked decisions

| Decision | Choice |
|---|---|
| Data source | Steam Store `appdetails` with `filters=basic,metacritic,recommendations` |
| Cache | Separate type `appdetails_stats` — **never** write `appdetails` |
| Shared `fetchAppDetails` | **Do not** change filters or write shape |
| Review % | Show only if present in JSON; do **not** scrape reviews HTML |
| HLTB | **Deferred** (user chose A) — no hours, no HLTB HTTP, no `hltb` cache in this PR |
| UI | Strip under hero; hunter copy only; no Download/store CTA |
| Load | Separate IPC `get-game-hunter-stats`; fire after detail succeeds |
| Deps | No new npm packages |
| Prefetch | Detail open only — not library scan |

## Architecture

```
get-game-detail → getStoreCoverUrl → fetchAppDetails (basic) → api_cache 'appdetails'
     UNCHANGED

GameDetailPage → get-game-hunter-stats → gameHunterStatsService
                   → httpGet Store filters=basic,metacritic,recommendations
                   → api_cache 'appdetails_stats' (1d)
                   → shared/hunterStatsUtils parse + format
```

## Out of scope (this child)

- HowLongToBeat / any hours fields
- electron-updater (E), redist, launch, Depot, Scan, playtime
- Steam user-reviews HTML scrape
- Hydra API / new deps
- Schema migrations / `games` columns
- Changing Hubcap `getSteamDetails`

## Regression surfaces to protect

- Library covers (`getStoreCoverUrl` / `achieveme-img://cover`)
- Game Detail hero backdrop (`library_hero` CDN, not appdetails)
- Enrich / Refresh name + cover via existing `appdetails`
- Hubcap Store fetch (independent URL/filters)
- Play / redist / context menu / scan

---

## Addendum — Metacritic box + Steam sentiment (2026-09-08)

**Status:** Approved

### Goal

Replace the plain-text hunter line with Steam-like chrome: Metacritic score **box** (MC color bands) and colored `review_score_desc` text from Steam `appreviews`.

### Locked

| Decision | Choice |
|---|---|
| Sentiment | `appreviews?json=1&…&num_per_page=0` → `query_summary.review_score_desc` |
| Metacritic | Still from Store `appdetails` metacritic filter |
| Cache | `hunter_metacritic` (7d TTL, Metacritic only); reviews never durable; never write cover `appdetails` |
| MC bands | green ≥75, yellow 50–74, red ≤49 |
| Sentiment colors | positive `#66C0F4`, mixed `#B9A404`, negative `#C35C2B` |
| Cover `fetchAppDetails` | Untouched |

### Architecture (updated)

```
GameDetailPage → get-game-hunter-stats (forceRefresh false) → cache only
  → api_cache 'hunter_metacritic' + 'hunter_reviews'
  → GameHunterStatsStrip

Boot / Library warm / Refresh → get-game-hunter-stats (forceRefresh true)
  → parallel Steam appdetails + appreviews → write both caches
```

---

## Addendum — Boot splash warm + durable cache (2026-09-08)

**Status:** Approved

### Goal

Cold start shows a branded splash until prune + library network warm complete so Detail/News open ready.

### Locked cache policy

| Data | Persist? | Boot |
|---|---|---|
| schema / appdetails / steamdb / images | Yes (~7d / on disk) | Warm if missing/stale |
| Metacritic | Yes — `hunter_metacritic` ~7d | Force write on boot warm |
| Rarities (`percentages`) | No | Always live fetch |
| Reviews (`appreviews`) | Yes — `hunter_reviews` ~7d | Force write on boot warm; Detail reads cache only |
| News | No | Always `forceRefresh` |

### Boot flow

Prune obsolete `api_cache` (percentages, news rows, old `appdetails_stats*`) + orphan images → warm all numeric library appids (concurrency 3) → news forceRefresh → show shell. Fail-soft; never infinite splash. Cover `fetchAppDetails` (`filters=basic`) unchanged.

---

## Addendum — Reviews cache + Detail read-only (2026-09-08)

**Status:** Approved

### Goal

Game Detail never live-fetches hunter stats. Strip is instant from cache.

### Locked

| Decision | Choice |
|---|---|
| Detail | `forceRefresh: false` — zero HTTP |
| Reviews cache | `hunter_reviews` ~7d |
| Library open | `hunter:warm-library` fills missing/stale (concurrency 3) |
| Refresh | `forceRefresh: true` after `processAppId` |
| Metacritic scrape | Out of scope — Steam only; omit when missing |
