import {
  formatBackupRelativeTime,
  isLudusaviUnchangedSnapshotNote
} from './ludusaviApiUtils.ts'

/**
 * Builds a short Game Detail label for Ludusavi backup status.
 *
 * @param status - Stored `backup_status` value.
 * @param backupAt - Unix seconds of last attempt.
 * @param nowSeconds - Reference now (defaults to current time).
 * @param backupError - Optional soft note or failure message.
 */
export function formatBackupStatusLabel(
  status: string,
  backupAt: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  backupError: string = ''
): string {
  const clean = String(status || '').trim().toLowerCase()
  if (clean === 'running') return 'Backing up…'
  if (clean === 'ok') {
    if (isLudusaviUnchangedSnapshotNote(backupError)) {
      return 'Saves unchanged — no new snapshot'
    }
    const relative = formatBackupRelativeTime(backupAt, nowSeconds)
    return relative ? `Saves backed up · ${relative}` : 'Saves backed up'
  }
  if (clean === 'failed') return 'Backup failed'
  if (clean === 'missing') return 'Not in Ludusavi'
  return 'No backup yet'
}
