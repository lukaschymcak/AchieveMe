/** Compact playtime for cards/stats: `1h 20m`, `45m`, or `—` when zero. */
export function formatPlaytimeCompact(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Detail-line playtime: `1h 20m played`, `45m played`, or `—` when zero. */
export function formatPlaytimePlayed(seconds: number): string {
  const compact = formatPlaytimeCompact(seconds)
  if (compact === '—') return '—'
  return `${compact} played`
}
