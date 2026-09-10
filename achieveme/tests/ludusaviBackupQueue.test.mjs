import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { createLudusaviBackupQueue } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviBackupQueue.ts')).href
)

function baseSettings(overrides = {}) {
  return {
    ludusaviPath: 'C:\\Tools\\ludusavi.exe',
    ludusaviAutoBackup: true,
    ludusaviBackupOnStartup: true,
    ludusaviBackupOnSessionEnd: true,
    ludusaviBackupOnAddGame: true,
    ...overrides
  }
}

function makeGame(appid, overrides = {}) {
  return {
    appid,
    name: `Game ${appid}`,
    total_achievements: 0,
    unlocked_achievements: 0,
    completion_pct: 0,
    has_platinum: 0,
    last_unlocked_at: 0,
    schema_fetched_at: 0,
    playtime_seconds: 0,
    install_path: '',
    launch_exe: '',
    playtime_session_started_at: 0,
    playtime_last_flush_at: 0,
    manifest_gids: '',
    update_status: '',
    backup_status: '',
    backup_at: 0,
    backup_error: '',
    ludusavi_title: '',
    cloud_saves_enabled: 0,
    steamless_applied: 0,
    goldberg_applied: 0,
    steamless_exe: '',
    goldberg_dll_path: '',
    ...overrides
  }
}

test('two schedule calls for same appid run once', async () => {
  const backupCalls = []
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [makeGame('570')],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async (_exe, title) => {
      backupCalls.push(title)
      return { ok: true, decision: 'Processed', change: 'Different', bytes: 1 }
    },
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    nowSeconds: () => 100
  })

  queue.scheduleGameBackup('570', 'manual')
  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()

  assert.equal(backupCalls.length, 1)
  assert.ok(statuses.some((s) => s.status === 'running'))
  const ok = statuses.find((s) => s.status === 'ok')
  assert.ok(ok)
  assert.equal(ok.error, '')
})

test('cloud upload runs after Different backup when per-game cloud enabled', async () => {
  const { R2_CLOUD_UPLOAD_FAILED_NOTE } = await import(
    pathToFileURL(path.join(rootDir, '../src/shared/r2CloudSaveUtils.ts')).href
  )
  const uploadCalls = []
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: 'tok'
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 1 }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Different',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    uploadCloudSave: async (input) => {
      uploadCalls.push(input)
      return { ok: false, softNote: R2_CLOUD_UPLOAD_FAILED_NOTE }
    },
    nowSeconds: () => 100
  })

  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(uploadCalls.length, 1)
  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'ok')
  assert.equal(last.error, R2_CLOUD_UPLOAD_FAILED_NOTE)
})

test('cloud upload is skipped for Same backups', async () => {
  let uploadCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: 'tok'
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 1 }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Same',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    uploadCloudSave: async () => {
      uploadCalls += 1
      return { ok: true }
    }
  })
  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(uploadCalls, 0)
})

test('cloud upload is skipped when change signal is missing', async () => {
  let uploadCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: 'tok'
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 1 }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    uploadCloudSave: async () => {
      uploadCalls += 1
      return { ok: true }
    }
  })
  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(uploadCalls, 0)
})

test('restore does not call uploadCloudSave', async () => {
  let uploadCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: 'tok'
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 1 }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({ ok: false, error: 'unexpected' }),
    restoreGame: async () => ({ ok: true, decision: 'Processed', bytes: 1 }),
    uploadCloudSave: async () => {
      uploadCalls += 1
      return { ok: true }
    }
  })
  queue.scheduleGameRestore('570', 'snap-1')
  await queue.drain()
  assert.equal(uploadCalls, 0)
})

test('cloud upload skipped when token empty even if per-game cloud on', async () => {
  let uploadCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: ''
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 1 }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Different',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected' }),
    uploadCloudSave: async () => {
      uploadCalls += 1
      return { ok: true }
    }
  })
  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(uploadCalls, 0)
})

test('cloud upload skipped when per-game cloud disabled', async () => {
  let uploadCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        cloudSavesApiUrl: 'https://saves.example.com',
        cloudSavesApiToken: 'tok'
      }),
    getAllGames: () => [],
    getGame: () =>
      makeGame('570', { ludusavi_title: 'Dota 2', cloud_saves_enabled: 0 }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Different',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected' }),
    uploadCloudSave: async () => {
      uploadCalls += 1
      return { ok: true }
    }
  })
  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(uploadCalls, 0)
})

test('cloud conflict soft note from backupGame is stored with ok status', async () => {
  const { LUDUSAVI_CLOUD_CONFLICT_NOTE } = await import(
    pathToFileURL(path.join(rootDir, '../src/shared/ludusaviCloudUtils.ts')).href
  )
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings({ ludusaviCloudSync: true }),
    getAllGames: () => [],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Different',
      bytes: 1,
      error: LUDUSAVI_CLOUD_CONFLICT_NOTE
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    nowSeconds: () => 100
  })

  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()

  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'ok')
  assert.equal(last.error, LUDUSAVI_CLOUD_CONFLICT_NOTE)
})

test('unchanged Same backup stores soft note with ok status', async () => {
  const { LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE } = await import(
    pathToFileURL(path.join(rootDir, '../src/shared/ludusaviApiUtils.ts')).href
  )
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Same',
      bytes: 1
    }),
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' }),
    nowSeconds: () => 100
  })

  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()

  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'ok')
  assert.equal(last.error, LUDUSAVI_UNCHANGED_SNAPSHOT_NOTE)
})

test('successful restore clears soft note and does not use Same note', async () => {
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({ ok: false, error: 'unexpected backup' }),
    restoreGame: async () => ({
      ok: true,
      decision: 'Processed',
      change: 'Same',
      bytes: 2
    }),
    nowSeconds: () => 200
  })

  queue.scheduleGameRestore('570', 'snap-9')
  await queue.drain()

  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'ok')
  assert.equal(last.error, '')
})

test('missing title sets missing status', async () => {
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('999'),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => null,
    backupGame: async () => ({ ok: true }),
    restoreGame: async () => ({ ok: true }),
    nowSeconds: () => 50
  })

  queue.scheduleGameBackup('999', 'manual')
  await queue.drain()

  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'missing')
  assert.match(last.error, /Not in Ludusavi/i)
})

test('auto backup off skips non-manual reasons', async () => {
  let backupCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings({ ludusaviAutoBackup: false }),
    getAllGames: () => [makeGame('570')],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => {
      backupCalls += 1
      return { ok: true }
    },
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' })
  })

  queue.scheduleGameBackup('570', 'session')
  queue.scheduleLibraryBackup('startup')
  await queue.drain()
  assert.equal(backupCalls, 0)

  queue.scheduleGameBackup('570', 'manual')
  await queue.drain()
  assert.equal(backupCalls, 1)
})

test('auto backup on runs session only; startup and add are ignored', async () => {
  let backupCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () =>
      baseSettings({
        ludusaviAutoBackup: true,
        ludusaviBackupOnStartup: true,
        ludusaviBackupOnAddGame: true
      }),
    getAllGames: () => [makeGame('570')],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => {
      backupCalls += 1
      return { ok: true, decision: 'Processed', change: 'Different', bytes: 1 }
    },
    restoreGame: async () => ({ ok: false, error: 'unexpected restore' })
  })

  queue.scheduleLibraryBackup('startup')
  queue.scheduleGameBackup('570', 'add')
  await queue.drain()
  assert.equal(backupCalls, 0)

  queue.scheduleGameBackup('570', 'session')
  await queue.drain()
  assert.equal(backupCalls, 1)
})

test('empty ludusaviPath is a no-op even for manual', async () => {
  let backupCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings({ ludusaviPath: '' }),
    getAllGames: () => [makeGame('570')],
    getGame: () => makeGame('570'),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'X',
    backupGame: async () => {
      backupCalls += 1
      return { ok: true }
    },
    restoreGame: async () => {
      backupCalls += 1
      return { ok: true }
    }
  })

  queue.scheduleGameBackup('570', 'manual')
  queue.scheduleGameRestore('570', 'snap-1')
  await queue.drain()
  assert.equal(backupCalls, 0)
})

test('scheduleGameRestore calls restoreGame with backup id', async () => {
  const restoreCalls = []
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({ ok: false, error: 'unexpected backup' }),
    restoreGame: async (_exe, title, backupId) => {
      restoreCalls.push({ title, backupId })
      return { ok: true, decision: 'Processed', bytes: 2 }
    },
    nowSeconds: () => 200
  })

  queue.scheduleGameRestore('570', 'snap-9')
  await queue.drain()

  assert.deepEqual(restoreCalls, [{ title: 'Dota 2', backupId: 'snap-9' }])
  assert.ok(statuses.some((s) => s.status === 'ok'))
})

test('invalid restore backup id never calls CLI', async () => {
  let restoreCalls = 0
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('570', { ludusavi_title: 'Dota 2' }),
    updateGameBackupStatus: () => undefined,
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => 'Dota 2',
    backupGame: async () => ({ ok: true }),
    restoreGame: async () => {
      restoreCalls += 1
      return { ok: true }
    }
  })

  queue.scheduleGameRestore('570', '../evil')
  queue.scheduleGameRestore('570', '')
  await queue.drain()
  assert.equal(restoreCalls, 0)
})

test('restore missing title sets missing status', async () => {
  const statuses = []
  const queue = createLudusaviBackupQueue({
    loadSettings: () => baseSettings(),
    getAllGames: () => [],
    getGame: () => makeGame('111'),
    updateGameBackupStatus: (appid, update) => {
      statuses.push({ appid, ...update })
    },
    notifyLibraryUpdated: () => undefined,
    validateLudusaviPath: (p) => p,
    findTitleBySteamId: async () => null,
    backupGame: async () => ({ ok: true }),
    restoreGame: async () => ({ ok: true }),
    nowSeconds: () => 10
  })

  queue.scheduleGameRestore('111', 'snap-1')
  await queue.drain()

  const last = statuses[statuses.length - 1]
  assert.equal(last.status, 'missing')
})
