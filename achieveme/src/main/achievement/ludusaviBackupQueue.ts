import type { AppSettings, Game } from '../../shared/types'
import type { LudusaviBackupResult } from './ludusaviService'

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
  restoreGame: (exe: string, title: string) => Promise<LudusaviBackupResult>
  nowSeconds?: () => number
}

export interface LudusaviBackupQueueSnapshot {
  runningAppid: string | null
  pending: string[]
}

export interface LudusaviBackupQueue {
  scheduleGameBackup: (appid: string, reason: LudusaviBackupReason) => void
  scheduleGameRestore: (appid: string) => void
  scheduleLibraryBackup: (reason: 'startup' | 'manual') => void
  getBackupQueueSnapshot: () => LudusaviBackupQueueSnapshot
  /** Drains the queue (tests). */
  drain: () => Promise<void>
  reset: () => void
}

interface PendingJob {
  appid: string
  op: LudusaviQueueOp
}

function shouldRunForReason(settings: AppSettings, reason: LudusaviBackupReason): boolean {
  const path = String(settings.ludusaviPath || '').trim()
  if (!path) return false
  if (reason === 'manual') return true
  if (!settings.ludusaviAutoBackup) return false
  if (reason === 'startup') return settings.ludusaviBackupOnStartup !== false
  if (reason === 'session') return settings.ludusaviBackupOnSessionEnd !== false
  if (reason === 'add') return settings.ludusaviBackupOnAddGame !== false
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

  const enqueue = (appid: string, op: LudusaviQueueOp): void => {
    const clean = String(appid || '').trim()
    if (!/^\d+$/.test(clean)) return
    if (pendingSet.has(clean) || runningAppid === clean) return
    pendingSet.add(clean)
    pending.push({ appid: clean, op })
  }

  const pump = async (): Promise<void> => {
    if (pumping) return
    pumping = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()!
        pendingSet.delete(job.appid)
        runningAppid = job.appid
        await runOne(job.appid, job.op)
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

  const runOne = async (appid: string, op: LudusaviQueueOp): Promise<void> => {
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
          ? await deps.restoreGame(exe, title)
          : await deps.backupGame(exe, title)

      if (result.ok) {
        deps.updateGameBackupStatus(appid, {
          status: 'ok',
          at: nowSeconds(),
          error: '',
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
    scheduleGameRestore(appid) {
      try {
        const settings = deps.loadSettings()
        if (!String(settings.ludusaviPath || '').trim()) return
        enqueue(appid, 'restore')
        kick()
      } catch {
        // Never throw to callers
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
    // Safe no-op queue before configure (tests / early calls)
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

export function scheduleGameRestore(appid: string): void {
  requireQueue().scheduleGameRestore(appid)
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
