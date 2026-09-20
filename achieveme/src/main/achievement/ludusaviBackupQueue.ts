import type { AppSettings, Game } from '../../shared/types'
import {
  getActiveLudusaviConfigDir,
  LUDUSAVI_FULL_BACKUP_LIMIT,
  type LudusaviBackupResult
} from './ludusaviService.ts'
import {
  isChangedLudusaviBackup,
  isSafeLudusaviBackupId,
  isUnchangedLudusaviBackup,
  LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE
} from '../../shared/ludusaviApiUtils.ts'
import { cloudSavesConfigured } from '../../shared/r2CloudSaveUtils.ts'
import {
  isCloudSnapshotBackupId,
  pruneOldLudusaviSnapshots,
  resolveLudusaviGameBackupDir
} from './ludusaviBackupArchive.ts'
import { cloudSavesLog, cloudSavesWarn } from './cloudSavesDebugLog.ts'

export type LudusaviBackupReason = 'startup' | 'session' | 'add' | 'manual'
export type LudusaviQueueOp = 'backup' | 'restore'

export interface LudusaviBackupQueueDeps {
  loadSettings: () => AppSettings
  getAllGames: () => Game[]
  getGame: (appid: string) => Game | undefined
  updateGameBackupStatus: (
    appid: string,
    update: { status: string; at: number; error?: string; ludusaviTitle?: string }
  ) => void
  notifyLibraryUpdated: (appid?: string) => void
  validateLudusaviPath: (ludusaviPath: string) => string
  findTitleBySteamId: (exe: string, appid: string) => Promise<string | null>
  backupGame: (exe: string, title: string) => Promise<LudusaviBackupResult>
  restoreGame: (
    exe: string,
    title: string,
    backupId?: string
  ) => Promise<LudusaviBackupResult>
  /**
   * Optional post-backup cloud upload. Failures must return soft notes, not throw.
   */
  uploadCloudSave?: (input: {
    settings: AppSettings
    appid: string
    title: string
  }) => Promise<{ ok: boolean; softNote?: string }>
  /**
   * Optional snapshot pruning callback. Defaults to pruning local snapshots beyond limit.
   */
  pruneSnapshots?: (title: string) => Promise<void>
  nowSeconds?: () => number
}

export interface LudusaviBackupQueueSnapshot {
  runningAppid: string | null
  pending: string[]
}

export interface LudusaviBackupQueue {
  scheduleGameBackup: (appid: string, reason: LudusaviBackupReason) => void
  scheduleGameRestore: (appid: string, backupId: string) => void
  scheduleLibraryBackup: (reason: 'startup' | 'manual') => void
  getBackupQueueSnapshot: () => LudusaviBackupQueueSnapshot
  /** Drains the queue (tests). */
  drain: () => Promise<void>
  reset: () => void
}

interface PendingJob {
  appid: string
  op: LudusaviQueueOp
  backupId?: string
}

function shouldRunForReason(settings: AppSettings, reason: LudusaviBackupReason): boolean {
  const path = String(settings.ludusaviPath || '').trim()
  if (!path) return false
  if (reason === 'manual') return true
  // Auto-backup is session-end only (cloud auto-upload rides the same backup).
  if (reason === 'session') return Boolean(settings.ludusaviAutoBackup)
  return false
}

/**
 * Creates a single-flight Ludusavi backup/restore queue for library AppIDs.
 *
 * @param deps - Injectable settings, DB, CLI, and notify adapters.
 */
export function createLudusaviBackupQueue(deps: LudusaviBackupQueueDeps): LudusaviBackupQueue {
  let runningAppid: string | null = null
  let pumping = false
  const pending: PendingJob[] = []
  const pendingSet = new Set<string>()

  const nowSeconds = (): number =>
    deps.nowSeconds ? deps.nowSeconds() : Math.floor(Date.now() / 1000)

  const enqueue = (appid: string, op: LudusaviQueueOp, backupId?: string): void => {
    const clean = String(appid || '').trim()
    if (!/^\d+$/.test(clean)) return
    if (pendingSet.has(clean) || runningAppid === clean) return
    pendingSet.add(clean)
    pending.push({ appid: clean, op, backupId })
  }

  const pump = async (): Promise<void> => {
    if (pumping) return
    pumping = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()!
        pendingSet.delete(job.appid)
        runningAppid = job.appid
        await runOne(job)
        runningAppid = null
      }
    } finally {
      pumping = false
      runningAppid = null
      if (pending.length > 0) {
        void pump().catch(() => undefined)
      }
    }
  }

  const runOne = async (job: PendingJob): Promise<void> => {
    const { appid, op, backupId } = job
    try {
      const settings = deps.loadSettings()
      const path = String(settings.ludusaviPath || '').trim()
      if (!path) return

      let exe: string
      try {
        exe = deps.validateLudusaviPath(path)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        deps.updateGameBackupStatus(appid, {
          status: 'failed',
          at: nowSeconds(),
          error: message
        })
        deps.notifyLibraryUpdated(appid)
        return
      }

      deps.updateGameBackupStatus(appid, {
        status: 'running',
        at: nowSeconds(),
        error: ''
      })
      deps.notifyLibraryUpdated(appid)

      const game = deps.getGame(appid)
      let title = String(game?.ludusavi_title || '').trim()
      if (!title) {
        title = (await deps.findTitleBySteamId(exe, appid))?.trim() || ''
      }

      if (!title) {
        deps.updateGameBackupStatus(appid, {
          status: 'missing',
          at: nowSeconds(),
          error: 'Not in Ludusavi'
        })
        deps.notifyLibraryUpdated(appid)
        return
      }

      const result =
        op === 'restore'
          ? await deps.restoreGame(exe, title, backupId)
          : await deps.backupGame(exe, title)

      cloudSavesLog(op === 'restore' ? 'queue.restore.result' : 'queue.backup.result', {
        appid,
        title,
        backupId: backupId || null,
        ok: result.ok,
        decision: result.decision || null,
        change: result.change || null,
        error: result.error || null
      })

      if (result.ok) {
        let softNote = ''
        if (op === 'backup') {
          // Rotate local snapshots: prune oldest beyond limit
          if (deps.pruneSnapshots) {
            await deps.pruneSnapshots(title).catch(() => undefined)
          } else {
            try {
              const configDir = getActiveLudusaviConfigDir()
              if (configDir && title) {
                const gameDir = resolveLudusaviGameBackupDir(configDir, title, { apiBackupPath: null })
                await pruneOldLudusaviSnapshots(gameDir, LUDUSAVI_FULL_BACKUP_LIMIT)
              }
            } catch {
              // Non-blocking
            }
          }

          if (isUnchangedLudusaviBackup(result)) {
            softNote = LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE
            cloudSavesLog('queue.auto-upload.skip', {
              appid,
              reason: 'unchanged-same',
              change: result.change || null
            })
          } else if (result.error) {
            softNote = result.error
          } else if (
            deps.uploadCloudSave &&
            Number(game?.cloud_saves_enabled) === 1 &&
            cloudSavesConfigured(settings.cloudSavesApiUrl, settings.cloudSavesApiToken)
          ) {
            if (!isChangedLudusaviBackup(result)) {
              cloudSavesLog('queue.auto-upload.skip', {
                appid,
                reason: 'no-change-signal',
                change: result.change || null
              })
            } else {
              cloudSavesLog('queue.auto-upload.start', {
                appid,
                title,
                change: result.change || null
              })
              const cloud = await deps.uploadCloudSave({
                settings,
                appid,
                title
              })
              cloudSavesLog('queue.auto-upload.done', {
                appid,
                ok: cloud.ok,
                softNote: cloud.softNote || null
              })
              if (!cloud.ok && cloud.softNote) {
                softNote = cloud.softNote
              }
            }
          }
        }
        deps.updateGameBackupStatus(appid, {
          status: 'ok',
          at: nowSeconds(),
          error: softNote,
          ludusaviTitle: title
        })
      } else {
        deps.updateGameBackupStatus(appid, {
          status: 'failed',
          at: nowSeconds(),
          error: result.error || (op === 'restore' ? 'Restore failed.' : 'Backup failed.'),
          ludusaviTitle: title
        })
      }
      deps.notifyLibraryUpdated(appid)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      try {
        deps.updateGameBackupStatus(appid, {
          status: 'failed',
          at: nowSeconds(),
          error: message
        })
        deps.notifyLibraryUpdated(appid)
      } catch {
        // Never throw to callers / pump loop
      }
    }
  }

  const kick = (): void => {
    void pump().catch(() => {
      // Never throw to callers
    })
  }

  return {
    scheduleGameBackup(appid, reason) {
      try {
        const settings = deps.loadSettings()
        if (!shouldRunForReason(settings, reason)) return
        enqueue(appid, 'backup')
        kick()
      } catch {
        // Never throw to callers
      }
    },
    scheduleGameRestore(appid, backupId) {
      try {
        const settings = deps.loadSettings()
        if (!String(settings.ludusaviPath || '').trim()) {
          cloudSavesWarn('queue.restore.skip', { appid, reason: 'no-ludusavi-path' })
          return
        }
        const id = String(backupId || '').trim()
        if (!isSafeLudusaviBackupId(id)) {
          cloudSavesWarn('queue.restore.skip', { appid, backupId: id, reason: 'unsafe-id' })
          return
        }
        cloudSavesLog('queue.restore.enqueue', {
          appid,
          backupId: id,
          isCloud: isCloudSnapshotBackupId(id)
        })
        enqueue(appid, 'restore', id)
        kick()
      } catch (err) {
        cloudSavesWarn('queue.restore.enqueue-failed', {
          appid,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    },
    scheduleLibraryBackup(reason) {
      try {
        const settings = deps.loadSettings()
        if (!shouldRunForReason(settings, reason)) return
        const games = deps.getAllGames()
        for (const game of games) {
          enqueue(game.appid, 'backup')
        }
        kick()
      } catch {
        // Never throw to callers
      }
    },
    getBackupQueueSnapshot() {
      return {
        runningAppid,
        pending: pending.map((job) => job.appid)
      }
    },
    async drain() {
      await pump()
      while (pending.length > 0 || runningAppid) {
        await pump()
      }
    },
    reset() {
      pending.length = 0
      pendingSet.clear()
      runningAppid = null
      pumping = false
    }
  }
}

let singleton: LudusaviBackupQueue | null = null

/**
 * Wires the process-wide backup queue (call once at app startup).
 *
 * @param deps - Production adapters.
 */
export function configureLudusaviBackupQueue(deps: LudusaviBackupQueueDeps): void {
  singleton = createLudusaviBackupQueue(deps)
}

function requireQueue(): LudusaviBackupQueue {
  if (!singleton) {
    return createLudusaviBackupQueue({
      loadSettings: () =>
        ({
          ludusaviPath: '',
          ludusaviAutoBackup: false
        }) as AppSettings,
      getAllGames: () => [],
      getGame: () => undefined,
      updateGameBackupStatus: () => undefined,
      notifyLibraryUpdated: () => undefined,
      validateLudusaviPath: () => '',
      findTitleBySteamId: async () => null,
      backupGame: async () => ({ ok: false, error: 'not configured' }),
      restoreGame: async () => ({ ok: false, error: 'not configured' })
    })
  }
  return singleton
}

export function scheduleGameBackup(appid: string, reason: LudusaviBackupReason): void {
  requireQueue().scheduleGameBackup(appid, reason)
}

export function scheduleGameRestore(appid: string, backupId: string): void {
  requireQueue().scheduleGameRestore(appid, backupId)
}

export function scheduleLibraryBackup(reason: 'startup' | 'manual'): void {
  requireQueue().scheduleLibraryBackup(reason)
}

export function getBackupQueueSnapshot(): LudusaviBackupQueueSnapshot {
  return requireQueue().getBackupQueueSnapshot()
}

/** Test helper — replace the singleton queue. */
export function setLudusaviBackupQueueForTest(queue: LudusaviBackupQueue | null): void {
  singleton = queue
}
