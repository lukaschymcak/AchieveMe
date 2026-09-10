import fs from 'node:fs'

/**
 * Dev-facing cloud saves logger. Prints to the Electron main process console
 * (the terminal running `npm run dev`). Never logs tokens or full URLs with secrets.
 */

const PREFIX = '[cloud-saves]'

const MAX_TEXT = 800

/**
 * Truncates long CLI stdout/stderr for log lines.
 */
export function truncateCloudLogText(text: string, max = MAX_TEXT): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max)}…(+${clean.length - max})`
}

/**
 * Lists top-level names in a directory (best-effort).
 */
export function listDirNamesForLog(dir: string): string[] {
  try {
    return fs.readdirSync(dir).slice(0, 40)
  } catch {
    return []
  }
}

/**
 * Info-level cloud saves log.
 */
export function cloudSavesLog(event: string, detail?: Record<string, unknown>): void {
  if (detail && Object.keys(detail).length > 0) {
    console.log(PREFIX, event, detail)
    return
  }
  console.log(PREFIX, event)
}

/**
 * Warn-level cloud saves log.
 */
export function cloudSavesWarn(event: string, detail?: Record<string, unknown>): void {
  if (detail && Object.keys(detail).length > 0) {
    console.warn(PREFIX, event, detail)
    return
  }
  console.warn(PREFIX, event)
}

/**
 * Error-level cloud saves log.
 */
export function cloudSavesError(event: string, detail?: Record<string, unknown>): void {
  if (detail && Object.keys(detail).length > 0) {
    console.error(PREFIX, event, detail)
    return
  }
  console.error(PREFIX, event)
}
