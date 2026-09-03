/**
 * Validates import-existing-install inputs without touching the filesystem.
 *
 * @param input - AppID, path flags, and selected depot GIDs.
 * @returns Error message, or null when valid.
 */
export function validateImportExistingInstall(input: {
  appid: string
  installPath: string
  gids: Record<string, string>
  pathExists: boolean
  isDirectory: boolean
}): string | null {
  const appid = String(input.appid || '').trim()
  if (!/^\d+$/.test(appid)) {
    return 'Invalid AppID.'
  }
  const installPath = String(input.installPath || '').trim()
  if (!installPath) {
    return 'Install folder is required.'
  }
  if (!input.pathExists) {
    return 'Install folder does not exist.'
  }
  if (!input.isDirectory) {
    return 'Install path must be a directory.'
  }
  const gids = input.gids || {}
  if (Object.keys(gids).length === 0) {
    return 'Select at least one depot with a manifest GID.'
  }
  return null
}
