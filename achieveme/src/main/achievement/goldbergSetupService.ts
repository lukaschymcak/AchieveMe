import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { loadSettings } from '../settings'
import { processAppId } from './processAppId'
import type { GoldbergApplyRequest } from '../../shared/types'
import { expandEnv } from './savePathUtils'
import {
  buildProgressFromSchema,
  readAchievementSchema,
  validateDllPath
} from './goldbergFolderUtils'

function resolveGeneratorDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'generate_emu_config')
  }
  return path.join(app.getAppPath(), '..', 'goldberg-files', 'generate_emu_config')
}

function copyDirectoryMerge(source: string, target: string): void {
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

function readIniValue(iniText: string, section: string, key: string): string | null {
  const lines = iniText.split(/\r?\n/)
  let inSection = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inSection = trimmed.slice(1, -1) === section
      continue
    }
    if (!inSection || !trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k === key) return v
  }

  return null
}

/** Resolve emulator save root from steam_settings/configs.user.ini (matches Goldberg/GSE runtime). */
function resolveSaveRoot(gameDir: string, steamSettingsDir: string): string {
  const configsPath = path.join(steamSettingsDir, 'configs.user.ini')
  if (!fs.existsSync(configsPath)) {
    throw new Error(`configs.user.ini was not found: ${configsPath}`)
  }

  const ini = fs.readFileSync(configsPath, 'utf8')
  const localSavePath = readIniValue(ini, 'user::saves', 'local_save_path')?.trim() ?? ''

  if (localSavePath) {
    return path.isAbsolute(localSavePath)
      ? path.resolve(localSavePath)
      : path.resolve(gameDir, localSavePath)
  }

  const folderName = readIniValue(ini, 'user::saves', 'saves_folder_name')?.trim() || 'GSE Saves'
  return path.join(expandEnv('%APPDATA%'), folderName)
}

async function runGenerator(
  appid: string,
  generatorDir: string,
  log: (line: string) => void
): Promise<string> {
  const generatorExe = path.join(generatorDir, 'generate_emu_config.exe')

  if (!fs.existsSync(generatorExe)) {
    throw new Error(`generate_emu_config.exe not found at: ${generatorExe}`)
  }

  const outputDir = path.join(generatorDir, '_OUTPUT', appid)
  if (fs.existsSync(outputDir)) {
    log(`Clearing previous output for AppID ${appid}...`)
    fs.rmSync(outputDir, { recursive: true, force: true })
  }

  log(`Running generator for AppID ${appid}...`)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(generatorExe, ['-acw', appid], {
      cwd: generatorDir,
      windowsHide: true
    })

    child.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split(/\r?\n/)
      for (const line of lines) {
        if (line.trim()) log(line)
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split(/\r?\n/)
      for (const line of lines) {
        if (line.trim()) log(line)
      }
    })

    child.on('close', (code) => {
      if (code === 0 || fs.existsSync(outputDir)) {
        resolve()
      } else {
        reject(new Error(`Generator exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })

  const settingsSource = path.join(outputDir, 'steam_settings')
  if (!fs.existsSync(settingsSource)) {
    throw new Error(`Generated steam_settings folder was not found: ${settingsSource}`)
  }

  return settingsSource
}

export async function applyGoldberg(
  request: GoldbergApplyRequest,
  settings: ReturnType<typeof loadSettings>,
  log: (line: string) => void
): Promise<void> {
  const { appid, dllPath } = request
  if (!/^\d+$/.test(appid)) {
    throw new Error(`Invalid AppID: ${appid}`)
  }

  const { gameDir } = validateDllPath(dllPath)
  log(`Game folder: ${gameDir}`)

  const generatorDir = resolveGeneratorDir()
  const settingsSource = await runGenerator(appid, generatorDir, log)

  const settingsTarget = path.join(gameDir, 'steam_settings')
  if (fs.existsSync(settingsTarget)) {
    log('Replacing existing steam_settings...')
    fs.rmSync(settingsTarget, { recursive: true, force: true })
  }
  log('Copying steam_settings to game folder...')
  copyDirectoryMerge(settingsSource, settingsTarget)
  log(`steam_settings installed at: ${settingsTarget}`)

  const schemaPath = path.join(settingsSource, 'achievements.json')

  log('Reading achievement schema...')
  const schema = readAchievementSchema(schemaPath)
  const progress = buildProgressFromSchema(schema)
  log(`Found ${Object.keys(progress).length} achievements.`)

  const saveRoot = resolveSaveRoot(gameDir, settingsTarget)
  const savesDir = path.join(saveRoot, appid)
  const savesFile = path.join(savesDir, 'achievements.json')

  log(`Emulator save root: ${saveRoot}`)

  if (fs.existsSync(savesFile)) {
    log('Save file already exists — skipping seed to preserve existing progress.')
  } else {
    fs.mkdirSync(savesDir, { recursive: true })
    fs.writeFileSync(savesFile, JSON.stringify(progress, null, 2), 'utf8')
    log(`Seeded achievements.json at: ${savesFile}`)
  }

  log('Processing game into library...')
  await processAppId(appid, settings, true)
  log('Done. Game added to library.')
}
