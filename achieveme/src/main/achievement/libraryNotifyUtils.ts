import type { LibraryUpdatedPayload } from '../../shared/types'

/** Coalesce queued appids into a single renderer payload. */
export function buildLibraryUpdatedPayload(appids: Iterable<string | null>): LibraryUpdatedPayload {
  const unique = new Set<string>()
  let hasGeneric = false

  for (const appid of appids) {
    if (appid === null) {
      hasGeneric = true
      continue
    }
    unique.add(appid)
  }

  if (!hasGeneric && unique.size === 1) {
    return { appid: [...unique][0] }
  }

  return {}
}
