import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { loadSettings } from '../settings'
import { processAppId } from './processAppId'
import { getDb } from '../db/database'
import {
  updateGameInstallPath,
  unignoreAppid,
  removeWantedGame,
  saveGameToolApply,
  getGame
} from '../db/repository'
import type { GoldbergApplyRequest } from '../../shared/types'
import { expandEnv } from './savePathUtils'
import {
  buildProgressFromSchema,
  installGoldbergEmuDll,
  readAchievementSchema,
  validateDllPath
} from './goldbergFolderUtils'
import { installSteamSettings } from './goldbergSteamSettingsUtils'
import { syncGseSavesToLudusavi } from './ludusaviCustomGames'
import { resolveLudusaviGuiConfigPath } from './ludusaviConfigPatch'

function resolveGeneratorDir(): string {
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'generate_emu_config'))
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      candidates.push(
        path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'resources', 'generate_emu_config')
      )
    }
  }

  candidates.push(
    path.join(app.getAppPath(), '..', 'goldberg-files', 'generate_emu_config'),
    path.join(app.getAppPath(), 'goldberg-files', 'generate_emu_config'),
    path.join(app.getAppPath(), '..', '..', 'goldberg-files', 'generate_emu_config')
  )

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'generate_emu_config.exe'))) {
      return candidate
    }
  }

  return app.isPackaged
    ? path.join(process.resourcesPath, 'generate_emu_config')
    : path.join(app.getAppPath(), '..', 'goldberg-files', 'generate_emu_config')
}

/** Goldberg release root containing `regular/{x64|x86}/`. */
function resolveReleaseDir(): string {
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'goldberg_release'))
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'resources', 'goldberg_release'))
    }
  }

  candidates.push(
    path.join(app.getAppPath(), '..', 'goldberg-files', 'release'),
    path.join(app.getAppPath(), 'goldberg-files', 'release'),
    path.join(app.getAppPath(), '..', '..', 'goldberg-files', 'release')
  )

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'regular', 'x64', 'steam_api64.dll')) ||
      fs.existsSync(path.join(candidate, 'x64', 'steam_api64.dll'))
    ) {
      return candidate
    }
  }

  return app.isPackaged
    ? path.join(process.resourcesPath, 'goldberg_release')
    : path.join(app.getAppPath(), '..', 'goldberg-files', 'release')
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
  log: (line: string) => void,
  credentials?: { username: string; password: string }
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

  const spawnEnv: NodeJS.ProcessEnv = { ...process.env }
  if (credentials?.username) {
    spawnEnv['GSE_CFG_USERNAME'] = credentials.username
    spawnEnv['GSE_CFG_PASSWORD'] = credentials.password || ''
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(generatorExe, ['-acw', appid], {
      cwd: generatorDir,
      windowsHide: true,
      env: spawnEnv
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

export const DEFAULT_GSE_CREDENTIALS = {
  username: 'goldie_0003',
  password: 'BabaYaga0003'
}

export async function applyGoldberg(
  request: GoldbergApplyRequest,
  settings: ReturnType<typeof loadSettings>,
  log: (line: string) => void
): Promise<void> {
  const { appid, dllPath, installEmuDll, denuvoOfflineActivated } = request
  if (!/^\d+$/.test(appid)) {
    throw new Error(`Invalid AppID: ${appid}`)
  }

  const { gameDir, fileName } = validateDllPath(dllPath)
  log(`Game folder: ${gameDir}`)

  if (installEmuDll) {
    const architecture = fileName.toLowerCase() === 'steam_api64.dll' ? 'x64' : 'x86'
    installGoldbergEmuDll({
      dllPath,
      architecture,
      releaseRoot: resolveReleaseDir(),
      log
    })
  }

  const generatorDir = resolveGeneratorDir()
  const credentials =
    settings?.gseUsername?.trim()
      ? { username: settings.gseUsername.trim(), password: settings.gsePassword?.trim() || '' }
      : DEFAULT_GSE_CREDENTIALS
  const settingsSource = await runGenerator(appid, generatorDir, log, credentials)

  const settingsTarget = path.join(gameDir, 'steam_settings')
  installSteamSettings({
    source: settingsSource,
    target: settingsTarget,
    preserveDenuvoConfigs: denuvoOfflineActivated,
    log
  })

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
  unignoreAppid(getDb(), appid)
  removeWantedGame(getDb(), appid)
  await processAppId(appid, settings, true, true)
  const game = getGame(getDb(), appid)
  const gameTitle = game?.ludusavi_title || game?.name
  const guiConfigPath = resolveLudusaviGuiConfigPath()
  if (gameTitle && guiConfigPath) {
    try {
      syncGseSavesToLudusavi(appid, gameTitle, [savesDir], guiConfigPath)
    } catch {
      // Non-blocking
    }
  }
  updateGameInstallPath(getDb(), appid, gameDir)
  saveGameToolApply(getDb(), appid, {
    goldbergApplied: true,
    goldbergDllPath: dllPath
  })
  log('Done. Game added to library.')
}
