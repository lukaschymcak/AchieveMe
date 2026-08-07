import Database from 'better-sqlite3'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const dbPath = path.join(os.homedir(), 'AppData/Roaming/achieveme/achieveme.db')
const db = new Database(dbPath)
const rows = db.prepare('SELECT appid, name, manifest_gids, update_status FROM games').all()
console.log('GAMES', JSON.stringify(rows, null, 2))

const withGids = rows.filter((r) => r.manifest_gids && String(r.manifest_gids).trim() !== '')
let target = withGids[0]
let mode = 'poison'

if (!target) {
  target = rows[0]
  mode = 'seed'
}

if (!target) {
  console.log('NO_GAMES')
  db.close()
  process.exit(0)
}

let next
if (mode === 'poison') {
  const parsed = JSON.parse(target.manifest_gids)
  const firstKey = Object.keys(parsed)[0]
  parsed[firstKey] = '000000000000000001'
  next = JSON.stringify(parsed)
} else {
  next = JSON.stringify({ '99999': '000000000000000001' })
}

db.prepare("UPDATE games SET manifest_gids = ?, update_status = '' WHERE appid = ?").run(
  next,
  target.appid
)
console.log(mode.toUpperCase(), target.appid, target.name, next)
db.close()
