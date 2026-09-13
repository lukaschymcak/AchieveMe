/**
 * Pure calculation and formatting utilities for BootSplash.
 * Shared between main, renderer, and tests (zero Electron / React dependencies).
 */

export type BootWarmPhase = 'prune' | 'library' | 'games' | 'news' | 'done' | 'error'

export interface BootPhaseMeta {
  readonly id: 'prune' | 'library' | 'games' | 'news'
  readonly short: string
  readonly title: string
  readonly description: string
}

export const BOOT_STAGES: readonly BootPhaseMeta[] = [
  {
    id: 'prune',
    short: 'PRUNE',
    title: 'Cache Audit',
    description: 'Auditing image cache and storage'
  },
  {
    id: 'library',
    short: 'LIBRARY',
    title: 'Save Discovery',
    description: 'Discovering emulator save folders'
  },
  {
    id: 'games',
    short: 'GAMES',
    title: 'Catalog Sync',
    description: 'Enriching achievements and metadata'
  },
  {
    id: 'news',
    short: 'NEWS',
    title: 'Community News',
    description: 'Syncing Steam community announcements'
  }
] as const

/**
 * Maps a phase string to its 0-indexed stage position (0..3).
 * Returns 4 for 'done', or -1 for 'error' / unknown.
 */
export function getBootPhaseIndex(phase: string | undefined | null): number {
  if (!phase) return 0
  switch (phase) {
    case 'prune':
      return 0
    case 'library':
      return 1
    case 'games':
      return 2
    case 'news':
      return 3
    case 'done':
      return 4
    case 'error':
      return -1
    default:
      return 0
  }
}

/**
 * Calculates a rounded, clamped percentage between 0 and 100.
 * Returns 0 if total is 0 or negative, or if values are invalid.
 */
export function computeBootProgressPct(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return 0
  }
  const pct = (current / total) * 100
  return Math.min(100, Math.max(0, Math.round(pct)))
}

export interface FormattedBootStatus {
  readonly stageTitle: string
  readonly detailLabel: string
  readonly percent: number | null
  readonly showCount: boolean
  readonly isDeterminate: boolean
}

/**
 * Formats phase progress into user-facing copy and metrics.
 */
export function formatBootStatus(
  phase: string | undefined | null,
  rawLabel: string | undefined | null,
  current = 0,
  total = 0
): FormattedBootStatus {
  const isGames = phase === 'games'
  const hasValidCount = Number.isFinite(total) && total > 0 && Number.isFinite(current)
  const isDeterminate = isGames && hasValidCount
  const percent = isDeterminate ? computeBootProgressPct(current, total) : null

  let stageTitle = 'INITIALIZING'
  if (phase === 'prune') stageTitle = 'CACHE AUDIT'
  else if (phase === 'library') stageTitle = 'LOCAL LIBRARY'
  else if (phase === 'games') stageTitle = 'METADATA & RARITY SYNC'
  else if (phase === 'news') stageTitle = 'COMMUNITY UPDATES'
  else if (phase === 'done') stageTitle = 'READY'
  else if (phase === 'error') stageTitle = 'DIAGNOSTICS'

  const detailLabel = (rawLabel && rawLabel.trim()) || 'Preparing showcase…'

  return {
    stageTitle,
    detailLabel,
    percent,
    showCount: isDeterminate,
    isDeterminate
  }
}
