import fs from 'node:fs'
import path from 'node:path'
import type { GoldbergProgress, SteamApiDllInfo } from '../../shared/types'

export function resolveGameDir(gameDir: string): string {
  const resolved = path.resolve(gameDir)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Game folder was not found: ${resolved}`)
  }
  return resolved
}

export function validateDllPath(dllPath: string): { gameDir: string; fileName: string } {
  const resolved = path.resolve(dllPath)
  const fileName = path.basename(resolved)
  const lower = fileName.toLowerCase()
  if (lower !== 'steam_api.dll' && lower !== 'steam_api64.dll') {
    throw new Error('Select steam_api.dll or steam_api64.dll.')
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Steam API DLL was not found: ${resolved}`)
  }
  return { gameDir: path.dirname(resolved), fileName }
}

export function findSteamApiDll(gameDir: string): SteamApiDllInfo | null {
  for (const fileName of ['steam_api64.dll', 'steam_api.dll']) {
    const dllPath = path.join(gameDir, fileName)
    if (fs.existsSync(dllPath)) {
      return {
        path: dllPath,
        fileName,
        directory: gameDir,
        architecture: fileName === 'steam_api64.dll' ? 'x64' : 'x86'
      }
    }
  }
  return null
}

export function hasSteamSettingsFolder(gameDir: string): boolean {
  const settingsPath = path.join(gameDir, 'steam_settings')
  return fs.existsSync(settingsPath) && fs.statSync(settingsPath).isDirectory()
}

export function readAchievementSchema(schemaPath: string): Array<{ name?: string }> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`achievements.json was not found: ${schemaPath}`)
  }
  const schemaRaw = fs.readFileSync(schemaPath, 'utf8')
  const schema = JSON.parse(schemaRaw) as Array<{ name?: string }>
  if (!Array.isArray(schema)) {
    throw new Error(`achievements.json must be an array: ${schemaPath}`)
  }
  return schema
}

export function buildProgressFromSchema(schema: Array<{ name?: string }>): GoldbergProgress {
  const progress: GoldbergProgress = {}
  for (const entry of schema) {
    if (entry.name) {
      progress[entry.name] = { earned: false, earned_time: 0 }
    }
  }
  if (Object.keys(progress).length === 0) {
    throw new Error('No achievements found in the achievement schema.')
  }
  return progress
}

/**
 * Resolves the Goldberg regular-build emu DLL path for the given architecture.
 *
 * @param releaseRoot - Path to the Goldberg `release` folder (contains `regular/`).
 * @param architecture - Target DLL architecture from the browsed game DLL.
 * @returns Absolute path to `steam_api.dll` or `steam_api64.dll` in `regular/{arch}/`.
 */
export function resolveRegularEmuDllPath(
  releaseRoot: string,
  architecture: 'x86' | 'x64'
): string {
  const fileName = architecture === 'x64' ? 'steam_api64.dll' : 'steam_api.dll'
  return path.join(path.resolve(releaseRoot), 'regular', architecture, fileName)
}

export interface InstallGoldbergEmuDllOptions {
  /** Absolute path to the game's current steam_api(64).dll. */
  dllPath: string
  architecture: 'x86' | 'x64'
  /** Path to the Goldberg `release` folder (contains `regular/`). */
  releaseRoot: string
  log?: (line: string) => void
}

/**
 * Backs up the game steam_api DLL to `.bak` (overwriting any existing backup),
 * then copies the Goldberg regular emu DLL over the original.
 *
 * @param options - Target DLL, architecture, and release root.
 * @throws If the emu source DLL is missing or the game DLL cannot be read/written.
 */
export function installGoldbergEmuDll(options: InstallGoldbergEmuDllOptions): void {
  const { dllPath, architecture, releaseRoot, log = () => undefined } = options
  const targetDll = path.resolve(dllPath)
  const sourceDll = resolveRegularEmuDllPath(releaseRoot, architecture)

  if (!fs.existsSync(sourceDll)) {
    throw new Error(`Goldberg regular emu DLL was not found: ${sourceDll}`)
  }
  if (!fs.existsSync(targetDll)) {
    throw new Error(`Steam API DLL was not found: ${targetDll}`)
  }

  const backupPath = `${targetDll}.bak`
  log(`Backing up original DLL to: ${backupPath}`)
  fs.copyFileSync(targetDll, backupPath)

  log(`Installing Goldberg regular emu (${architecture})...`)
  fs.copyFileSync(sourceDll, targetDll)
  log(`Emulator DLL installed at: ${targetDll}`)
}
