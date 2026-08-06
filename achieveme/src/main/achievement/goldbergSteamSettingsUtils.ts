import fs from 'node:fs'
import path from 'node:path'

/** Top-level steam_settings INIs kept when installing over a Denuvo offline-activated setup. */
export const DENUVO_PRESERVE_CONFIG_FILES = [
  'configs.user.ini',
  'configs.overlay.ini',
  'configs.app.ini',
  'configs.main.ini'
] as const

export type DenuvoPreserveConfigFile = (typeof DENUVO_PRESERVE_CONFIG_FILES)[number]

/**
 * Recursively copies `source` into `target`, creating directories as needed.
 * Existing files in `target` are overwritten.
 */
export function copyDirectoryMerge(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true })

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const srcPath = path.join(source, entry.name)
    const destPath = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyDirectoryMerge(srcPath, destPath)
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Reads Denuvo-critical config INIs from an existing steam_settings folder.
 *
 * @returns Map of filename → file contents for files that exist
 */
export function stashDenuvoConfigFiles(steamSettingsDir: string): Map<string, Buffer> {
  const stash = new Map<string, Buffer>()
  for (const name of DENUVO_PRESERVE_CONFIG_FILES) {
    const filePath = path.join(steamSettingsDir, name)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue
    stash.set(name, fs.readFileSync(filePath))
  }
  return stash
}

/**
 * Writes previously stashed config files back into steam_settings.
 *
 * @returns Filenames that were restored
 */
export function restoreDenuvoConfigFiles(
  steamSettingsDir: string,
  stash: Map<string, Buffer>
): string[] {
  const restored: string[] = []
  fs.mkdirSync(steamSettingsDir, { recursive: true })
  for (const [name, contents] of stash) {
    fs.writeFileSync(path.join(steamSettingsDir, name), contents)
    restored.push(name)
  }
  return restored
}

export interface InstallSteamSettingsOptions {
  /** Generated steam_settings source directory. */
  readonly source: string
  /** Destination steam_settings path beside the game DLL. */
  readonly target: string
  /** When true, keep existing Denuvo config INIs after replace. */
  readonly preserveDenuvoConfigs: boolean
  /** Optional log line callback. */
  readonly log?: (line: string) => void
}

/**
 * Replaces `target` with a copy of `source`. When `preserveDenuvoConfigs` is set and
 * `target` already exists, restores Denuvo-critical INIs after the copy.
 */
export function installSteamSettings(options: InstallSteamSettingsOptions): string[] {
  const { source, target, preserveDenuvoConfigs, log } = options
  const stash =
    preserveDenuvoConfigs && fs.existsSync(target)
      ? stashDenuvoConfigFiles(target)
      : new Map<string, Buffer>()

  if (fs.existsSync(target)) {
    log?.('Replacing existing steam_settings...')
    fs.rmSync(target, { recursive: true, force: true })
  }

  log?.('Copying steam_settings to game folder...')
  copyDirectoryMerge(source, target)
  log?.(`steam_settings installed at: ${target}`)

  if (stash.size === 0) return []

  const restored = restoreDenuvoConfigFiles(target, stash)
  log?.(`Preserved Denuvo config files: ${restored.join(', ')}`)
  return restored
}
