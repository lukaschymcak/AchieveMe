/**
 * Prunes obsolete AppData caches: ephemeral api_cache rows and orphan image dirs.
 */

import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import {
  PRUNE_API_CACHE_TYPES
} from '../../shared/bootWarmUtils.ts'
import {
  deleteCacheEntriesByType,
  deleteCacheEntriesByTypePrefix,
  getAllGameAppids,
  getAllWantedAppids
} from '../db/repository.ts'
import { pruneGameImages } from './imageCacheService.ts'

export type AppDataPruneResult = {
  apiCacheRowsDeleted: number
  orphanImageDirsRemoved: number
}

/**
 * Deletes ephemeral/obsolete api_cache rows and image folders for non-library and non-wanted appids.
 *
 * @param db - Open SQLite database.
 * @param imagesRoot - Absolute `userData/images` path.
 */
export function pruneObsoleteAppData(
  db: Database.Database,
  imagesRoot: string
): AppDataPruneResult {
  let apiCacheRowsDeleted = 0

  for (const type of PRUNE_API_CACHE_TYPES) {
    apiCacheRowsDeleted += deleteCacheEntriesByType(db, type)
  }
  apiCacheRowsDeleted += deleteCacheEntriesByTypePrefix(db, 'news:')

  let orphanImageDirsRemoved = 0
  const libraryAppids = getAllGameAppids(db)
  const wantedAppids = getAllWantedAppids(db)
  const live = new Set([...libraryAppids, ...wantedAppids].filter((id) => /^\d+$/.test(id)))

  if (fs.existsSync(imagesRoot)) {
    let entries: string[] = []
    try {
      entries = fs.readdirSync(imagesRoot)
    } catch {
      entries = []
    }
    for (const name of entries) {
      if (!/^\d+$/.test(name)) continue
      if (live.has(name)) continue
      try {
        pruneGameImages(imagesRoot, name)
        orphanImageDirsRemoved += 1
      } catch {
        /* ignore single-dir failures */
      }
    }
  }

  return { apiCacheRowsDeleted, orphanImageDirsRemoved }
}

/**
 * Lists numeric child directory names under an images root (test helper).
 */
export function listImageAppidDirs(imagesRoot: string): string[] {
  if (!fs.existsSync(imagesRoot)) return []
  try {
    return fs
      .readdirSync(imagesRoot)
      .filter((name) => /^\d+$/.test(name) && fs.statSync(path.join(imagesRoot, name)).isDirectory())
  } catch {
    return []
  }
}
