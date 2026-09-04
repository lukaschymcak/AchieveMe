/**
 * Sequential Steamless → Goldberg reapply step picker (pure, no Electron).
 */

export type ReapplyToolId = 'steamless' | 'goldberg'

/**
 * Returns the next tool to run, or `done` when nothing remains.
 * Order is always steamless then goldberg. Skips unchecked or already completed tools.
 *
 * @param input - Inclusion flags and completed tool ids.
 */
export function nextReapplyTool(input: {
  includeSteamless: boolean
  includeGoldberg: boolean
  completed: ReapplyToolId[]
}): ReapplyToolId | 'done' {
  const done = new Set(input.completed)
  if (input.includeSteamless && !done.has('steamless')) return 'steamless'
  if (input.includeGoldberg && !done.has('goldberg')) return 'goldberg'
  return 'done'
}
