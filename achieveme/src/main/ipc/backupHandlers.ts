import { ipcMain, app } from 'electron'
import path from 'node:path'
import { getDb } from '../db/database'
import { getAllGames, getGame, updateGameBackupStatus, updateGameCloudSavesEnabled } from '../db/repository'
import { loadSettings } from '../settings'
import { notifyLibraryUpdated } from '../achievement/libraryNotifyService'
import {
  backupGame,
  findTitleBySteamId,
  listGameBackups,
  refreshAchieveMeLudusaviConfigFromGui,
  restoreGame,
  validateLudusaviPath,
  LUDUSAVI_FULL_BACKUP_LIMIT
} from '../achievement/ludusaviService'
import {
  addLudusaviGuiCustomPath,
  listLudusaviGuiCustomPaths,
  removeLudusaviGuiCustomPath
} from '../achievement/ludusaviCustomGames'
import { resolveLudusaviGuiConfigPath } from '../achievement/ludusaviConfigPatch'
import {
  pruneOldLudusaviSnapshots,
  resolveLudusaviGameBackupDir
} from '../achievement/ludusaviBackupArchive'
import type { LudusaviSnapshot } from '../../shared/ludusaviApiUtils'
import { isSafeLudusaviBackupId } from '../../shared/ludusaviApiUtils'
import { getAchieveMeLudusaviConfigDir } from '../../shared/ludusaviCloudUtils'
import { cloudSavesApiUrlHost, cloudSavesConfigured } from '../../shared/r2CloudSaveUtils'
import {
  downloadNewestGameCloudSave,
  downloadGameCloudSave,
  listGameCloudArtifacts,
  uploadGameCloudSave
} from '../achievement/r2CloudSaveService'
import { cloudSavesLog } from '../achievement/cloudSavesDebugLog'
import {
  configureLudusaviBackupQueue,
  getBackupQueueSnapshot,
  scheduleGameBackup,
  scheduleGameRestore,
  scheduleLibraryBackup
} from '../achievement/ludusaviBackupQueue'
import { SETTINGS_COPY } from '../../shared/settingsPageUtils'
import {
  assertValidAppid,
  resolveLudusaviExeOrError,
  resolveLudusaviTitleOrError
} from './handlerUtils'

/** Initialise the backup queue with its dependencies. Called once at startup. */
export function initBackupQueue(): void {
  configureLudusaviBackupQueue({
    loadSettings,
    getAllGames: () => getAllGames(getDb()),
    getGame: (appid) => getGame(getDb(), appid),
    updateGameBackupStatus: (appid, update) => updateGameBackupStatus(getDb(), appid, update),
    notifyLibraryUpdated,
    validateLudusaviPath,
    findTitleBySteamId: async (exe, appid) => {
      const settings = loadSettings()
      refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
      return findTitleBySteamId(exe, appid)
    },
    backupGame: async (exe, title) => {
      const settings = loadSettings()
      refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
      return backupGame(exe, title)
    },
    restoreGame: async (exe, title, backupId) => {
      const settings = loadSettings()
      refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
      return restoreGame(exe, title, backupId, undefined, {
        configDir: getAchieveMeLudusaviConfigDir(app.getPath('userData')),
        stagingRoot: path.join(app.getPath('userData'), 'Backups', 'restore-staging')
      })
    },
    uploadCloudSave: async ({ settings, appid, title }) => {
      refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
      const configDir = getAchieveMeLudusaviConfigDir(app.getPath('userData'))
      const outputDir = path.join(app.getPath('userData'), 'Backups')
      const result = await uploadGameCloudSave({ settings, appid, title, configDir, outputDir })
      if (result.ok) return { ok: true }
      return { ok: false, softNote: result.softNote || undefined }
    },
    pruneSnapshots: async (title: string) => {
      const configDir = getAchieveMeLudusaviConfigDir(app.getPath('userData'))
      const gameDir = resolveLudusaviGameBackupDir(configDir, title, { apiBackupPath: null })
      await pruneOldLudusaviSnapshots(gameDir, LUDUSAVI_FULL_BACKUP_LIMIT)
    }
  })
}

export function registerBackupHandlers(): void {
  ipcMain.handle('ludusavi:cloud-status', () => {
    const settings = loadSettings()
    return {
      configured: cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken),
      apiUrlHost: cloudSavesApiUrlHost(settings.cloudSavesApiUrl)
    }
  })

  ipcMain.handle(
    'games:set-cloud-saves-enabled',
    (_event, appid: string, enabled: boolean): { ok: boolean; error?: string } => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
        return { ok: false, error: SETTINGS_COPY.cloudNotConfigured }
      }
      const game = getGame(getDb(), check.clean)
      if (!game) return { ok: false, error: 'Game not found.' }
      updateGameCloudSavesEnabled(getDb(), check.clean, Boolean(enabled))
      notifyLibraryUpdated(check.clean)
      return { ok: true }
    }
  )

  ipcMain.handle(
    'ludusavi:cloud-list-game',
    async (
      _event,
      appid: string
    ): Promise<
      | { ok: true; artifacts: Awaited<ReturnType<typeof listGameCloudArtifacts>> }
      | { ok: false; error: string }
    > => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
        return { ok: false, error: SETTINGS_COPY.cloudNotConfigured }
      }
      try {
        const artifacts = await listGameCloudArtifacts({ settings, appid: check.clean })
        return { ok: true, artifacts }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to list cloud backups.' }
      }
    }
  )

  ipcMain.handle(
    'ludusavi:cloud-download-game',
    async (
      _event,
      appid: string,
      artifactId?: string
    ): Promise<{ ok: boolean; error?: string; backupId?: string }> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
        return { ok: false, error: SETTINGS_COPY.cloudNotConfigured }
      }
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult

      const titleResult = await resolveLudusaviTitleOrError(check.clean, exeResult.exe)
      if (!titleResult.ok) return titleResult

      const configDir = getAchieveMeLudusaviConfigDir(app.getPath('userData'))
      const tempDir = path.join(app.getPath('userData'), 'Backups', 'downloads')
      refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
      return downloadGameCloudSave({
        settings,
        appid: check.clean,
        title: titleResult.title,
        configDir,
        tempDir,
        artifactId: artifactId ? String(artifactId).trim() : undefined
      })
    }
  )

  ipcMain.handle(
    'ludusavi:cloud-upload-game',
    async (
      _event,
      appid: string,
      backupId: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const id = String(backupId || '').trim()
      if (!isSafeLudusaviBackupId(id)) return { ok: false, error: 'Invalid snapshot id.' }

      const settings = loadSettings()
      if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
        return { ok: false, error: SETTINGS_COPY.cloudNotConfigured }
      }
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult

      const titleResult = await resolveLudusaviTitleOrError(check.clean, exeResult.exe)
      if (!titleResult.ok) return titleResult
      const { title } = titleResult

      updateGameBackupStatus(getDb(), check.clean, {
        status: 'running',
        at: Math.floor(Date.now() / 1000),
        error: '',
        ludusaviTitle: title
      })
      notifyLibraryUpdated(check.clean)

      try {
        const configDir = getAchieveMeLudusaviConfigDir(app.getPath('userData'))
        const outputDir = path.join(app.getPath('userData'), 'Backups')
        refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
        const result = await uploadGameCloudSave({
          settings,
          appid: check.clean,
          title,
          configDir,
          outputDir,
          backupId: id
        })

        updateGameBackupStatus(getDb(), check.clean, {
          status: 'ok',
          at: Math.floor(Date.now() / 1000),
          error: result.ok ? '' : result.softNote || 'Cloud upload failed.',
          ludusaviTitle: title
        })
        notifyLibraryUpdated(check.clean)

        if (!result.ok) return { ok: false, error: result.softNote || 'Cloud upload failed.' }
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        updateGameBackupStatus(getDb(), check.clean, {
          status: 'ok',
          at: Math.floor(Date.now() / 1000),
          error: message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]') || 'Cloud upload failed.',
          ludusaviTitle: title
        })
        notifyLibraryUpdated(check.clean)
        return { ok: false, error: 'Cloud upload failed.' }
      }
    }
  )

  ipcMain.handle('ludusavi:cloud-download', async (): Promise<{ ok: boolean; error?: string }> => {
    const settings = loadSettings()
    if (!cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)) {
      return { ok: false, error: SETTINGS_COPY.cloudNotConfigured }
    }
    const exeResult = resolveLudusaviExeOrError(settings)
    if (!exeResult.ok) return exeResult

    const configDir = getAchieveMeLudusaviConfigDir(app.getPath('userData'))
    const tempDir = path.join(app.getPath('userData'), 'Backups', 'downloads')
    refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
    const games = getAllGames(getDb())
    let downloaded = 0
    let failed = 0
    for (const game of games) {
      const title = String(game.ludusavi_title || '').trim()
      if (!title) continue
      const result = await downloadNewestGameCloudSave({
        settings,
        appid: game.appid,
        title,
        configDir,
        tempDir
      })
      if (result.ok) downloaded += 1
      else failed += 1
    }
    if (downloaded === 0) {
      return {
        ok: false,
        error: failed > 0
          ? 'Cloud download failed (or no remote backups).'
          : 'No library games with Ludusavi titles to download.'
      }
    }
    return {
      ok: true,
      error: failed > 0
        ? `Downloaded ${downloaded}; ${failed} skipped/failed. Use Install backup on Game Detail.`
        : 'Downloaded into Ludusavi as Cloud save snapshot(s). Use Install backup on Game Detail to restore live saves.'
    }
  })

  ipcMain.handle('ludusavi:backup-game', (_event, appid: string): void => {
    scheduleGameBackup(String(appid || ''), 'manual')
  })

  ipcMain.handle(
    'ludusavi:list-backups',
    async (
      _event,
      appid: string
    ): Promise<{ title: string; snapshots: LudusaviSnapshot[] } | string> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check.error

      const settings = loadSettings()
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult.error

      const game = getGame(getDb(), check.clean)
      let title = String(game?.ludusavi_title || '').trim()
      if (!title) title = (await findTitleBySteamId(exeResult.exe, check.clean))?.trim() || ''
      if (!title) return 'Not in Ludusavi'

      try {
        refreshAchieveMeLudusaviConfigFromGui(settings.rclonePath)
        const snapshots = await listGameBackups(exeResult.exe, title)
        return { title, snapshots }
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    }
  )

  ipcMain.handle(
    'ludusavi:list-custom-paths',
    async (
      _event,
      appid: string
    ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult
      const titleResult = await resolveLudusaviTitleOrError(check.clean, exeResult.exe)
      if (!titleResult.ok) return titleResult

      const gui = resolveLudusaviGuiConfigPath()
      if (!gui) return { ok: true, title: titleResult.title, paths: [] }
      try { refreshAchieveMeLudusaviConfigFromGui(loadSettings().rclonePath) } catch { /* best effort */ }
      return {
        ok: true,
        title: titleResult.title,
        paths: listLudusaviGuiCustomPaths(gui, titleResult.title)
      }
    }
  )

  ipcMain.handle(
    'ludusavi:add-custom-path',
    async (
      _event,
      appid: string,
      folder: string
    ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult
      const titleResult = await resolveLudusaviTitleOrError(check.clean, exeResult.exe)
      if (!titleResult.ok) return titleResult

      const gui = resolveLudusaviGuiConfigPath()
      if (!gui) return { ok: false, error: 'Ludusavi config.yaml was not found. Open ludusavi.exe once.' }
      const result = addLudusaviGuiCustomPath(gui, titleResult.title, folder)
      if (!result.ok) return { ok: false, error: result.error || 'Could not add folder.' }
      try { refreshAchieveMeLudusaviConfigFromGui(loadSettings().rclonePath) } catch { /* GUI write succeeded */ }
      return { ok: true, title: titleResult.title, paths: result.paths }
    }
  )

  ipcMain.handle(
    'ludusavi:remove-custom-path',
    async (
      _event,
      appid: string,
      folder: string
    ): Promise<{ ok: true; title: string; paths: string[] } | { ok: false; error: string }> => {
      const check = assertValidAppid(appid)
      if (!check.ok) return check
      const settings = loadSettings()
      const exeResult = resolveLudusaviExeOrError(settings)
      if (!exeResult.ok) return exeResult
      const titleResult = await resolveLudusaviTitleOrError(check.clean, exeResult.exe)
      if (!titleResult.ok) return titleResult

      const gui = resolveLudusaviGuiConfigPath()
      if (!gui) return { ok: false, error: 'Ludusavi config.yaml was not found. Open ludusavi.exe once.' }
      const result = removeLudusaviGuiCustomPath(gui, titleResult.title, folder)
      if (!result.ok) return { ok: false, error: result.error || 'Could not remove folder.' }
      try { refreshAchieveMeLudusaviConfigFromGui(loadSettings().rclonePath) } catch { /* GUI write succeeded */ }
      return { ok: true, title: titleResult.title, paths: result.paths }
    }
  )

  ipcMain.handle('ludusavi:restore-game', (_event, appid: string, backupId: string): void => {
    const cleanAppid = String(appid || '')
    const id = String(backupId || '')
    cloudSavesLog('ipc.restore', { appid: cleanAppid, backupId: id })
    scheduleGameRestore(cleanAppid, id)
  })

  ipcMain.handle('ludusavi:backup-library', (): void => scheduleLibraryBackup('manual'))
  ipcMain.handle('ludusavi:get-queue', () => getBackupQueueSnapshot())
}
