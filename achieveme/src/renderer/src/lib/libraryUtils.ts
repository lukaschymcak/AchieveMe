import type { GameSummary } from '../../../shared/types'

export type SortOption = 'completion-asc' | 'unlocked-desc' | 'recent'

export function filterAndSortGames(
  games: GameSummary[],
  search: string,
  sort: SortOption
): GameSummary[] {
  const query = search.trim().toLowerCase()

  return games
    .filter((game) => !query || game.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === 'completion-asc') return a.completion_pct - b.completion_pct
      if (sort === 'unlocked-desc') return b.unlocked_achievements - a.unlocked_achievements
      if (sort === 'recent') return b.last_unlocked_at - a.last_unlocked_at
      return 0
    })
}
