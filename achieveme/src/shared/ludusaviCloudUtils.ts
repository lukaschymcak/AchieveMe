/**
 * Pure helpers for AchieveMe’s isolated Ludusavi cloud / rclone wiring.
 * Never touches the user’s Ludusavi GUI config directory.
 */

import path from 'node:path'

/** Soft note when Ludusavi reports a cloud sync conflict (no auto-resolve). */
export const LUDUSAVI_CLOUD_CONFLICT_NOTE =
  'Cloud conflict — local and cloud backups differ. Use Upload or Download in Settings to resolve.'

/** Soft note when a cloud sync attempt failed for other reasons. */
export const LUDUSAVI_CLOUD_SYNC_FAILED_NOTE =
  'Cloud sync failed. Check rclone / network, or use Upload / Download in Settings.'

/**
 * Cloud providers AchieveMe can configure via `ludusavi cloud set`.
 * Custom uses an existing rclone remote id; none disconnects.
 */
export type LudusaviCloudProviderId =
  | 'google-drive'
  | 'onedrive'
  | 'dropbox'
  | 'box'
  | 'custom'
  | 'none'

export const LUDUSAVI_CLOUD_PROVIDER_OPTIONS: ReadonlyArray<{
  id: LudusaviCloudProviderId
  label: string
}> = [
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'box', label: 'Box' },
  { id: 'custom', label: 'Custom rclone remote' },
  { id: 'none', label: 'None (disconnect)' }
]

/**
 * Builds `<userData>/ludusavi` for AchieveMe’s isolated Ludusavi `--config` dir.
 *
 * @param userDataPath - Electron `app.getPath('userData')`.
 */
export function getAchieveMeLudusaviConfigDir(userDataPath: string): string {
  const root = String(userDataPath || '').trim()
  if (!root) {
    throw new Error('userData path is required for Ludusavi config.')
  }
  return path.join(path.resolve(root), 'ludusavi')
}

/**
 * Prepends `--config <dir>` to Ludusavi argv when a config dir is set.
 *
 * @param configDir - Absolute AchieveMe Ludusavi config directory.
 * @param argv - Subcommand argv after the executable.
 */
export function withLudusaviConfig(configDir: string, argv: readonly string[]): string[] {
  const dir = String(configDir || '').trim()
  const rest = [...argv]
  if (!dir) return rest
  return ['--config', dir, ...rest]
}

/**
 * Returns true when a custom rclone remote id is safe to pass on the CLI.
 *
 * @param id - Remote name from rclone config.
 */
export function isSafeRcloneRemoteId(id: string): boolean {
  const clean = String(id || '').trim()
  if (!clean || clean.length > 120) return false
  if (/[\\/\0\r\n\s:]/.test(clean)) return false
  if (clean.includes('..')) return false
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clean)
}

/**
 * Builds `cloud set …` argv (without `--config`) for a provider choice.
 *
 * @param provider - Provider id from Settings.
 * @param customRemoteId - Required when provider is `custom`.
 */
export function buildCloudSetArgv(
  provider: LudusaviCloudProviderId,
  customRemoteId?: string
): string[] {
  switch (provider) {
    case 'none':
      return ['cloud', 'set', 'none']
    case 'google-drive':
      return ['cloud', 'set', 'google-drive']
    case 'onedrive':
      return ['cloud', 'set', 'onedrive']
    case 'dropbox':
      return ['cloud', 'set', 'dropbox']
    case 'box':
      return ['cloud', 'set', 'box']
    case 'custom': {
      const id = String(customRemoteId || '').trim()
      if (!isSafeRcloneRemoteId(id)) {
        throw new Error('Enter a valid rclone remote name (letters, numbers, . _ -).')
      }
      return ['cloud', 'set', 'custom', id]
    }
    default:
      throw new Error('Unknown cloud provider.')
  }
}

/**
 * Builds `cloud upload --force --api` argv (without `--config`).
 */
export function buildCloudUploadArgv(): string[] {
  return ['cloud', 'upload', '--force', '--api']
}

/**
 * Builds `cloud download --force --api` argv (without `--config`).
 */
export function buildCloudDownloadArgv(): string[] {
  return ['cloud', 'download', '--force', '--api']
}

/**
 * Human label for a provider id.
 *
 * @param provider - Provider id.
 */
export function ludusaviCloudProviderLabel(provider: string): string {
  const hit = LUDUSAVI_CLOUD_PROVIDER_OPTIONS.find((p) => p.id === provider)
  if (hit) return hit.label
  const raw = String(provider || '').trim()
  return raw || 'Unknown'
}

/**
 * Returns true when `backup_error` is a cloud conflict soft note.
 *
 * @param backupError - Stored error / note string.
 */
export function isLudusaviCloudConflictNote(backupError: string): boolean {
  return String(backupError || '').trim() === LUDUSAVI_CLOUD_CONFLICT_NOTE
}

/**
 * Detects a Ludusavi `--api` cloud conflict signal on a parsed payload.
 *
 * @param apiJson - Parsed JSON from Ludusavi stdout.
 */
export function hasLudusaviCloudConflict(apiJson: unknown): boolean {
  if (!apiJson || typeof apiJson !== 'object') return false
  const errors = (apiJson as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return false
  const conflict = (errors as { cloudConflict?: unknown }).cloudConflict
  return conflict != null && conflict !== false
}

/**
 * Detects a Ludusavi `--api` cloud sync failure signal.
 *
 * @param apiJson - Parsed JSON from Ludusavi stdout.
 */
export function hasLudusaviCloudSyncFailed(apiJson: unknown): boolean {
  if (!apiJson || typeof apiJson !== 'object') return false
  const errors = (apiJson as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return false
  const failed = (errors as { cloudSyncFailed?: unknown }).cloudSyncFailed
  return failed != null && failed !== false
}

/**
 * Picks a soft cloud note from API errors, or empty string when none.
 *
 * @param apiJson - Parsed JSON from Ludusavi stdout.
 */
export function ludusaviCloudSoftNoteFromApi(apiJson: unknown): string {
  if (hasLudusaviCloudConflict(apiJson)) return LUDUSAVI_CLOUD_CONFLICT_NOTE
  if (hasLudusaviCloudSyncFailed(apiJson)) return LUDUSAVI_CLOUD_SYNC_FAILED_NOTE
  return ''
}

/**
 * Parses a coarse cloud remote label from AchieveMe-owned config.yaml text.
 * Does not fully parse YAML — looks for known Ludusavi remote keys.
 *
 * @param configYaml - Raw config.yaml contents.
 */
export function parseCloudRemoteLabelFromConfigYaml(configYaml: string): string | null {
  const text = String(configYaml || '')
  if (!text.trim()) return null
  // Ludusavi stores remotes as nested keys under cloud.remote, e.g. GoogleDrive: { id: ... }
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /^\s*GoogleDrive\s*:/m, label: 'Google Drive' },
    { re: /^\s*OneDrive\s*:/m, label: 'OneDrive' },
    { re: /^\s*Dropbox\s*:/m, label: 'Dropbox' },
    { re: /^\s*Box\s*:/m, label: 'Box' },
    { re: /^\s*Custom\s*:/m, label: 'Custom rclone remote' },
    { re: /^\s*Ftp\s*:/m, label: 'FTP' },
    { re: /^\s*Smb\s*:/m, label: 'SMB' },
    { re: /^\s*WebDav\s*:/m, label: 'WebDAV' }
  ]
  for (const row of patterns) {
    if (row.re.test(text)) return row.label
  }
  if (/^\s*remote\s*:\s*~/m.test(text) || /^\s*remote\s*:\s*null\s*$/m.test(text)) {
    return null
  }
  return null
}
