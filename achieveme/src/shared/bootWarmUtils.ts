/**
 * Pure helpers for boot warm: appid normalization, concurrency pool, orchestration.
 */

import type { BootWarmProgress, BootWarmResult, RawAchievement } from './types.ts'

const NUMERIC_APPID = /^\d+$/

/**
 * Dedupes and keeps digit-only Steam AppIDs in stable order.
 */
export function normalizeWarmAppids(appids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of appids) {
    const id = String(raw ?? '').trim()
    if (!NUMERIC_APPID.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Runs an async worker over items with a fixed concurrency limit.
 *
 * @param items - Work items.
 * @param limit - Max in-flight workers (clamped to ≥1).
 * @param worker - Async work per item.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const n = Math.max(1, Math.floor(limit))
  let next = 0

  const runOne = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      await worker(items[index], index)
    }
  }

  const runners = Array.from({ length: Math.min(n, items.length) }, () => runOne())
  await Promise.all(runners)
}

/** Default network warm concurrency from the boot plan. */
export const BOOT_WARM_CONCURRENCY = 3

/** Durable api_cache types that survive boot prune. */
export const DURABLE_API_CACHE_TYPES = [
  'schema',
  'appdetails',
  'steamdb',
  'hunter_metacritic',
  'hunter_reviews'
] as const

/**
 * api_cache types deleted on every boot prune (ephemeral or obsolete).
 */
export const PRUNE_API_CACHE_TYPES = [
  'percentages',
  'appdetails_stats',
  'appdetails_stats_v2',
  'popularwishlist',
  'popularwishlist_v2',
  'popularwishlist_v3'
] as const

/**
 * Builds RawAchievement map from persisted achievement rows (save-folder free).
 */
export function rawFromPersistedAchievements(
  rows: Array<{
    api_name: string
    earned: number
    earned_time: number
    progress: number
    max_progress: number
  }>
): Record<string, RawAchievement> {
  const out: Record<string, RawAchievement> = {}
  for (const row of rows) {
    out[row.api_name] = {
      achieved: row.earned === 1,
      unlockTime: row.earned_time,
      progress: row.progress,
      maxProgress: row.max_progress
    }
  }
  return out
}

export type BootWarmProgressListener = (progress: BootWarmProgress) => void

/** Injectable steps for {@link runBootWarmCore} (no Electron imports). */
export type BootWarmCoreDeps = {
  prune: () => void
  listAppids: () => string[]
  getApiKey: () => string
  warmGame: (appid: string, apiKey: string) => Promise<void>
  warmNews: () => Promise<void>
  regenerateProfile: () => void
  concurrency?: number
}

function emit(
  onProgress: BootWarmProgressListener | undefined,
  progress: BootWarmProgress
): void {
  try {
    onProgress?.(progress)
  } catch {
    /* ignore UI listener errors */
  }
}

/**
 * Runs prune → library warm (concurrency pool) → news. Pure orchestration.
 */
export async function runBootWarmCore(
  onProgress: BootWarmProgressListener | undefined,
  deps: BootWarmCoreDeps
): Promise<BootWarmResult> {
  const concurrency = deps.concurrency ?? BOOT_WARM_CONCURRENCY

  emit(onProgress, {
    phase: 'prune',
    current: 0,
    total: 0,
    label: 'Pruning…'
  })
  try {
    deps.prune()
  } catch {
    /* fail-soft on prune */
  }

  emit(onProgress, {
    phase: 'library',
    current: 0,
    total: 0,
    label: 'Loading library…'
  })

  const appids = normalizeWarmAppids(deps.listAppids())
  const apiKey = deps.getApiKey()
  const total = appids.length
  let gamesWarmed = 0
  let gamesFailed = 0
  let completed = 0

  if (total > 0) {
    emit(onProgress, {
      phase: 'games',
      current: 0,
      total,
      label: 'Updating rarities…'
    })
  }

  await runWithConcurrency(appids, concurrency, async (appid) => {
    try {
      await deps.warmGame(appid, apiKey)
      gamesWarmed += 1
    } catch {
      gamesFailed += 1
    } finally {
      completed += 1
      emit(onProgress, {
        phase: 'games',
        current: completed,
        total,
        label: `Warming games (${completed}/${total})…`
      })
    }
  })

  try {
    deps.regenerateProfile()
  } catch {
    /* ignore */
  }

  emit(onProgress, {
    phase: 'news',
    current: total,
    total,
    label: 'Loading news…'
  })
  try {
    await deps.warmNews()
  } catch {
    /* fail-soft */
  }

  emit(onProgress, {
    phase: 'done',
    current: total,
    total,
    label: 'Ready'
  })

  return {
    ok: true,
    gamesWarmed,
    gamesFailed
  }
}
