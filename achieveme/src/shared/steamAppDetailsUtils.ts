type SteamAppDetailsEntry<T> = {
  success?: boolean
  data?: T & { steam_appid?: unknown }
}

/**
 * Picks the appdetails row for a store-search AppID.
 * Steam sometimes returns the body under a different key than the requested id
 * while `data.steam_appid` still matches (CONTROL Resonant: request 3669870, key 4760190).
 */
export function pickSteamAppDetailsEntry<T>(
  json: Record<string, SteamAppDetailsEntry<T>>,
  appId: string
): (T & { steam_appid?: unknown }) | undefined {
  const direct = json[appId]
  if (direct?.success && direct.data) return direct.data

  for (const entry of Object.values(json)) {
    if (!entry?.success || !entry.data) continue
    if (String(entry.data.steam_appid ?? '') === appId) return entry.data
  }

  return undefined
}
