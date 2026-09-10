# R2 Cloud Saves Design (2026-09-09)

## Goal

Hydra-style cloud saves for AchieveMe: Ludusavi keeps local snapshots; a Cloudflare Worker mints short-lived R2 URLs; Electron uploads/downloads `.tar.gz` archives. rclone is removed from the product path.

## Flow

1. Ludusavi `backup --no-cloud-sync --full-limit 5`
2. If change is not `Same`, Worker URL+token are set, and the game’s **Auto-upload after local backup** flag (`cloud_saves_enabled`) is on: archive the Ludusavi backup → PUT via Worker
3. Game Detail **cloud icon** opens the Cloud saves modal: **Auto-upload after local backup** toggles `cloud_saves_enabled`. When Worker URL+token are configured, always show remote list, **Upload**, and **Download** (auto-upload need not be on for manual ops). Download → additive `cloud-{artifactId}` folder labeled Cloud save
4. Floppy modal: Back up / Install only (Install picker labels Cloud save vs local)
5. Settings **Download** uses the same additive extract for library games
6. **Install backup**: local snapshots use `ludusavi restore --backup <id>`; Cloud save folders use stage-to-temp + `ludusavi restore --path` (Ludusavi does not know `cloud-*` as backup names). Named-snapshot uploads include game-root `mapping.yaml` / `registry.yaml` when missing from the snapshot folder
7. Before Ludusavi CLI / archive path reads, AchieveMe copies `%APPDATA%\ludusavi\config.yaml` into its isolated `--config` (keeps `cloud.synchronize: false` + rclone path) so backup.path / roots / customGames track the GUI

## Worker

See `cloud-saves-worker/`. Secrets: `API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

Upload mirrors Hydra legacy `CloudSync.uploadSaveGame`: prepare → PUT buffer with `Content-Type` only → complete. Location-hint buckets (e.g. EEUR) use the default `{account}.r2.cloudflarestorage.com` endpoint — do not set `R2_JURISDICTION=eeur`.

## Safety

- Bearer required on every route
- AppID `/^\d+$/` only; artifact ids 32 hex
- 2 GiB cap; retain 5 artifacts per appid
- Cloud upload failures soft-fail (local backup stays `ok`)
- Download never `rm`s the game backup root; only replaces that artifact’s `cloud-*` folder
- Token never logged; R2 keys never in Electron
