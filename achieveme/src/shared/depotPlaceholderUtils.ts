import fs from 'node:fs'
import path from 'node:path'

/** Bytes read from the start of a file when looking for an empty placeholder. */
const PLACEHOLDER_HEAD_BYTES = 65_536

/** Bytes read from the middle so a real file that begins with zeros is kept. */
const PLACEHOLDER_MID_BYTES = 4_096

/**
 * True when a file has size and both the start and the middle are all zeros.
 * DepotDownloader preallocates to the manifest size, then a size-only update
 * skips that file. A stalled run leaves those placeholders in place.
 *
 * @param filePath - Absolute path to a file
 */
export function isZeroPlaceholderFile(filePath: string): boolean {
  let size = 0
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return false
    size = stat.size
  } catch {
    return false
  }
  if (size <= 0) return false

  let fd: number | undefined
  try {
    fd = fs.openSync(filePath, 'r')
    if (!bufferIsZeros(fd, 0, Math.min(PLACEHOLDER_HEAD_BYTES, size))) return false
    const midLen = Math.min(PLACEHOLDER_MID_BYTES, size)
    const midOff = Math.max(0, Math.floor(size / 2) - Math.floor(midLen / 2))
    return bufferIsZeros(fd, midOff, midLen)
  } catch {
    return false
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.dll'])

/**
 * True when an `.exe` or `.dll` does not start with the DOS `MZ` signature.
 * A size-only update will skip it, so it has to be deleted and downloaded again.
 *
 * @param filePath - Absolute path to a file
 */
export function isCorruptExecutable(filePath: string): boolean {
  if (!EXECUTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false
  let size = 0
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return false
    size = stat.size
  } catch {
    return false
  }
  if (size < 2) return size > 0
  let fd: number | undefined
  try {
    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(2)
    const read = fs.readSync(fd, buf, 0, 2, 0)
    return read < 2 || buf[0] !== 0x4d || buf[1] !== 0x5a
  } catch {
    return false
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

/**
 * Deletes zero placeholders and corrupt executables under `root` so the next
 * DepotDownloader run treats them as missing and downloads them.
 *
 * @param root - Install directory
 * @returns Paths that were removed
 */
export function removeZeroPlaceholderFiles(root: string): string[] {
  const resolved = path.resolve(root)
  if (!fs.existsSync(resolved)) return []
  const removed: string[] = []
  walk(resolved, removed)
  return removed
}

function walk(dir: string, removed: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, removed)
      continue
    }
    if (!entry.isFile()) continue
    if (!isZeroPlaceholderFile(full) && !isCorruptExecutable(full)) continue
    try {
      fs.rmSync(full)
      removed.push(full)
    } catch {
      // The downloader can still replace a file it is allowed to open.
    }
  }
}

function bufferIsZeros(fd: number, offset: number, length: number): boolean {
  const buf = Buffer.alloc(length)
  const read = fs.readSync(fd, buf, 0, length, offset)
  if (read !== length) return false
  for (let i = 0; i < read; i++) {
    if (buf[i] !== 0) return false
  }
  return true
}
