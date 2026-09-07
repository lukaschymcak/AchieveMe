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
