import SteamUser from 'steam-user'
import type Database from 'better-sqlite3'
import type { ManifestCheckResult, ManifestCheckGameResult } from '../../shared/types'
import {
  parseManifestGidsJson,
  resolvePreferredBuildId,
  resolveUpdateStatus
} from '../../shared/manifestUpdateUtils'
import {
  getAllGamesWithGids,
  getGame,
  saveUpdateStatus
} from '../db/repository'
import { notifyLibraryUpdated } from './libraryNotifyService'

type DepotNode = {
  manifests?: {
    public?: {
      gid?: string | number
    }
  }
}

type DepotsNode = Record<string, DepotNode | unknown> & {
  branches?: {
    public?: {
      buildid?: string | number
    }
  }
}

/**
 * Queries Steam PICS anonymously for current depot manifest GIDs.
 *
 * @param appIds - Steam AppIDs to query.
 * @param timeoutMs - Hard timeout for login + product info.
 * @returns Flat list of depot rows across all requested apps.
 */
export async function runManifestChecker(
  appIds: string[],
  timeoutMs = 30_000
): Promise<ManifestCheckResult[]> {
  const ids = [...new Set(
    appIds
      .map((id) => String(id || '').trim())
      .filter((id) => /^\d+$/.test(id))
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => id > 0)
  )]
  if (!ids.length) return []

  return new Promise((resolve, reject) => {
    const client = new SteamUser({
      enablePicsCache: false,
      autoRelogin: false
    })
    let settled = false

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        client.logOff()
      } catch {
        // ignore log-off errors during teardown
      }
      try {
        client.removeAllListeners()
      } catch {
        // ignore
      }
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Manifest check timed out')))
    }, timeoutMs)

    client.once('error', (err: Error) => {
      finish(() => reject(err))
    })

    client.once('loggedOn', () => {
      void client
        .getProductInfo(ids, [])
        .then((productInfo) => {
          const results: ManifestCheckResult[] = []
          for (const [appIdKey, entry] of Object.entries(productInfo.apps ?? {})) {
            const appinfo = entry?.appinfo as { depots?: DepotsNode } | undefined
            const depots = appinfo?.depots
            if (!depots) continue

            const buildIdRaw = depots.branches?.public?.buildid
            const buildId = buildIdRaw != null ? String(buildIdRaw) : undefined

            for (const [depotId, depotValue] of Object.entries(depots)) {
              if (!/^\d+$/.test(depotId)) continue
              const depot = depotValue as DepotNode
              const gidRaw = depot?.manifests?.public?.gid
              const manifestGid = gidRaw != null ? String(gidRaw) : ''
              if (!manifestGid || manifestGid === '0') continue
              results.push({
                appId: String(appIdKey),
                depotId,
                manifestGid,
                buildId
              })
            }
          }
          finish(() => resolve(results))
        })
        .catch((err: unknown) => {
          finish(() => reject(err instanceof Error ? err : new Error(String(err))))
        })
    })

    client.logOn({ anonymous: true })
  })
}

/**
 * Checks one game against Steam PICS and persists `update_status`.
 *
 * @param db - Open SQLite database.
 * @param appid - Steam AppID.
 */
export async function checkGameUpdate(
  db: Database.Database,
  appid: string
): Promise<ManifestCheckGameResult> {
  const clean = String(appid || '').trim()
  if (!/^\d+$/.test(clean)) {
    throw new Error(`Invalid AppID for update check: ${appid}`)
  }

  const rows = await runManifestChecker([clean])
  const game = getGame(db, clean)
  const stored = parseManifestGidsJson(game?.manifest_gids)
  const status = resolveUpdateStatus(stored, rows)
  saveUpdateStatus(db, clean, status)
  notifyLibraryUpdated(clean)

  return {
    status,
    rows,
    buildId: resolvePreferredBuildId(rows)
  }
}

/**
 * Startup batch check for every game with stored manifest GIDs.
 * Failures are swallowed so existing statuses remain unchanged.
 *
 * @param db - Open SQLite database.
 */
export async function runStartupUpdateCheck(db: Database.Database): Promise<void> {
  const games = getAllGamesWithGids(db)
  if (!games.length) return

  try {
    const rows = await runManifestChecker(games.map((game) => game.appid))
    const byApp = new Map<string, ManifestCheckResult[]>()
    for (const row of rows) {
      const list = byApp.get(row.appId) || []
      list.push(row)
      byApp.set(row.appId, list)
    }

    let changed = false
    for (const game of games) {
      const live = byApp.get(game.appid) || []
      const stored = parseManifestGidsJson(game.manifest_gids)
      const status = resolveUpdateStatus(stored, live)
      if (!status) continue
      if (status === game.update_status) continue
      saveUpdateStatus(db, game.appid, status)
      changed = true
    }

    if (changed) {
      notifyLibraryUpdated()
    }
  } catch {
    // Silent failure — leave existing update_status values alone.
  }
}
