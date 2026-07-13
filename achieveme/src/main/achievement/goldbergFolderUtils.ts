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
