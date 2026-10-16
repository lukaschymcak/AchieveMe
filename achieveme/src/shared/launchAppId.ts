/** CLI flag: `AchieveMe.exe --launch-appid 2054970` starts that library game. */
export const LAUNCH_APPID_ARG = '--launch-appid'

/** Payload sent through Electron's single-instance lock. */
export interface LaunchAppIdPayload {
  launchAppId: string
}

/**
 * Reads a numeric AppID following `--launch-appid`.
 * Returns null when the flag is missing or the next token is not digits.
 *
 * @param argv - Process argument list.
 */
export function readLaunchAppId(argv: readonly string[]): string | null {
  const index = argv.indexOf(LAUNCH_APPID_ARG)
  if (index < 0) return null
  const next = String(argv[index + 1] ?? '').trim()
  if (/^\d+$/.test(next)) return next
  // Electron rewrites the second instance's command line and inserts its own
  // switches between the flag and the AppID, leaving the id as a later token.
  for (let i = argv.length - 1; i > index; i--) {
    const token = String(argv[i] ?? '').trim()
    if (/^\d+$/.test(token)) return token
  }
  return null
}

/**
 * Reads an AppID from the single-instance payload, then from argv.
 *
 * @param additionalData - Object passed to `requestSingleInstanceLock`.
 * @param argv - Command line of the instance that tried to start.
 */
export function readIncomingLaunchAppId(additionalData: unknown, argv: readonly string[]): string | null {
  if (additionalData && typeof additionalData === 'object' && 'launchAppId' in additionalData) {
    const value = String((additionalData as { launchAppId?: unknown }).launchAppId ?? '').trim()
    if (/^\d+$/.test(value)) return value
  }
  return readLaunchAppId(argv)
}
