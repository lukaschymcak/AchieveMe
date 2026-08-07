import Database from 'better-sqlite3'
import path from 'node:path'
import os from 'node:os'
import SteamUser from 'steam-user'

const APPID = '1135690' // Unpacking
const dbPath = path.join(os.homedir(), 'AppData/Roaming/achieveme/achieveme.db')

/**
 * @returns {Promise<Record<string, string>>}
 */
function fetchLiveGids(appId) {
  const id = Number.parseInt(appId, 10)
  return new Promise((resolve, reject) => {
    const client = new SteamUser({ enablePicsCache: false, autoRelogin: false })
    const timer = setTimeout(() => {
      try { client.logOff() } catch {}
      reject(new Error('timeout'))
    }, 30000)

    client.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    client.once('loggedOn', () => {
      void client.getProductInfo([id], []).then((info) => {
        clearTimeout(timer)
        try { client.logOff() } catch {}
        const entry = info.apps?.[id]
        const depots = entry?.appinfo?.depots || {}
        const out = {}
        for (const [depotId, depot] of Object.entries(depots)) {
          if (!/^\d+$/.test(depotId)) continue
          const gid = depot?.manifests?.public?.gid
          if (gid && String(gid) !== '0') out[depotId] = String(gid)
        }
        resolve(out)
        client.removeAllListeners()
      }).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    client.logOn({ anonymous: true })
  })
}

const live = await fetchLiveGids(APPID)
console.log('LIVE', live)

const db = new Database(dbPath)
db.prepare(
  "UPDATE games SET manifest_gids = ?, update_status = 'up_to_date' WHERE appid = ?"
).run(JSON.stringify(live), APPID)

const row = db.prepare('SELECT appid, name, manifest_gids, update_status FROM games WHERE appid = ?').get(APPID)
console.log('RESTORED_UNPACKING', row)
db.close()
