import fs from 'node:fs'
import path from 'node:path'

/**
 * Ensures parent directories exist and returns the config.yaml path.
 *
 * @param configDir - AchieveMe isolated Ludusavi `--config` directory.
 */
export function ludusaviConfigYamlPath(configDir: string): string {
  return path.join(path.resolve(configDir), 'config.yaml')
}

/**
 * Replaces or inserts a simple top-level-ish YAML scalar assignment for rclone path.
 * Operates only on AchieveMe-owned config.yaml — never the Ludusavi GUI config.
 *
 * Strategy: if `apps:` / `rclone:` / `path:` structure exists, rewrite the rclone path line;
 * otherwise append a minimal apps.rclone.path block.
 *
 * @param configYaml - Existing YAML text (may be empty).
 * @param rcloneExe - Absolute path to rclone.exe.
 */
export function patchRclonePathInConfigYaml(configYaml: string, rcloneExe: string): string {
  const exe = String(rcloneExe || '').trim().replace(/\\/g, '/')
  if (!exe) return String(configYaml || '')

  let text = String(configYaml || '')
  // Match apps.rclone.path: "..." or path: ... under a rclone block (best-effort).
  const pathLineRe = /^([ \t]*path:[ \t]*).+$/m
  if (/^\s*rclone\s*:/m.test(text) && pathLineRe.test(text)) {
    // Prefer replacing the first path under rclone section — fall back to first path: line after rclone
    const rcloneIdx = text.search(/^\s*rclone\s*:/m)
    if (rcloneIdx >= 0) {
      const before = text.slice(0, rcloneIdx)
      let after = text.slice(rcloneIdx)
      if (/^([ \t]*path:[ \t]*).+$/m.test(after)) {
        after = after.replace(/^([ \t]*path:[ \t]*).+$/m, `$1"${exe}"`)
        return before + after
      }
    }
  }

  const block = [
    'apps:',
    '  rclone:',
    `    path: "${exe}"`,
    '    arguments: "--fast-list --ignore-checksum"'
  ].join('\n')

  if (!text.trim()) {
    return `${block}\n`
  }
  if (/^\s*apps\s*:/m.test(text)) {
    // Append rclone under apps if missing
    if (!/^\s*rclone\s*:/m.test(text)) {
      return text.replace(/^\s*apps\s*:/m, `apps:\n  rclone:\n    path: "${exe}"\n    arguments: "--fast-list --ignore-checksum"`)
    }
  }
  return `${text.replace(/\s*$/, '')}\n\n${block}\n`
}

/**
 * Sets `cloud.synchronize` boolean in AchieveMe-owned config.yaml text.
 *
 * @param configYaml - Existing YAML text.
 * @param enabled - Whether automatic sync after backup is on.
 */
export function patchCloudSynchronizeInConfigYaml(configYaml: string, enabled: boolean): string {
  const value = enabled ? 'true' : 'false'
  let text = String(configYaml || '')
  if (/^\s*synchronize\s*:/m.test(text)) {
    return text.replace(/^([ \t]*synchronize:[ \t]*).+$/m, `$1${value}`)
  }
  if (/^\s*cloud\s*:/m.test(text)) {
    return text.replace(/^\s*cloud\s*:/m, `cloud:\n  synchronize: ${value}`)
  }
  const block = `cloud:\n  path: ludusavi-backup\n  synchronize: ${value}\n`
  if (!text.trim()) return block
  return `${text.replace(/\s*$/, '')}\n\n${block}`
}

/**
 * Writes patched rclone path into AchieveMe-owned config.yaml (creates file if needed).
 *
 * @param configDir - Isolated config directory.
 * @param rcloneExe - Absolute rclone.exe path.
 */
export function writeRclonePathToLudusaviConfig(configDir: string, rcloneExe: string): void {
  const dir = path.resolve(configDir)
  fs.mkdirSync(dir, { recursive: true })
  const file = ludusaviConfigYamlPath(dir)
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const next = patchRclonePathInConfigYaml(prev, rcloneExe)
  fs.writeFileSync(file, next, 'utf8')
}

/**
 * Writes cloud.synchronize into AchieveMe-owned config.yaml.
 *
 * @param configDir - Isolated config directory.
 * @param enabled - Sync flag.
 */
export function writeCloudSynchronizeToLudusaviConfig(configDir: string, enabled: boolean): void {
  const dir = path.resolve(configDir)
  fs.mkdirSync(dir, { recursive: true })
  const file = ludusaviConfigYamlPath(dir)
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const next = patchCloudSynchronizeInConfigYaml(prev, enabled)
  fs.writeFileSync(file, next, 'utf8')
}
