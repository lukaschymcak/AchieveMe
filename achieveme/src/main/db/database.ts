import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import { createTables } from './schema'

let db: Database.Database | null = null

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'achieveme.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createTables(db)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}
