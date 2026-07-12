import type { AppSettings } from '../../shared/types'
import { scanAllSources, type DiscoveredApp } from './discoveryService'
import { GOLDBERG_JSON_SOURCES } from './savePathUtils'

/** Goldberg/GSE saves found on disk that are not already in the covered set. */
export function discoverUncoveredGoldbergSaves(
  settings: AppSettings,
  covered: Set<string>,
  keyFor: (discovered: DiscoveredApp) => string
): DiscoveredApp[] {
  const results: DiscoveredApp[] = []

  for (const discovered of scanAllSources(settings)) {
    if (!GOLDBERG_JSON_SOURCES.includes(discovered.source)) continue

    const key = keyFor(discovered)
    if (covered.has(key)) continue

    covered.add(key)
    results.push(discovered)
  }

  return results
}
