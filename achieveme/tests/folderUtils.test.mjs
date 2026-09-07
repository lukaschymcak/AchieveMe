import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { getAppFolderPath, collectFilesRecursive, walkDirsBounded } = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/folderWalk.ts')).href
)

test('getAppFolderPath returns parent of achievements.json', () => {
  const folder = getAppFolderPath('C:\\GSE Saves\\3489700\\achievements.json')
  assert.equal(folder, 'C:\\GSE Saves\\3489700')
})

test('collectFilesRecursive returns nested files with forward-friendly relative paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-folder-'))
  try {
    const appDir = path.join(tmp, '3489700')
    const nested = path.join(appDir, 'subdir')
    fs.mkdirSync(nested, { recursive: true })
    fs.writeFileSync(path.join(appDir, 'achievements.json'), '{}')
    fs.writeFileSync(path.join(appDir, 'save.dat'), 'data')
    fs.writeFileSync(path.join(nested, 'extra.cfg'), 'cfg')

    const files = collectFilesRecursive(appDir)
    const rels = files.map((f) => f.relativePath).sort()

    assert.deepEqual(rels, ['achievements.json', 'save.dat', 'subdir/extra.cfg'])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('collectFilesRecursive returns empty array for missing directory', () => {
  const files = collectFilesRecursive(path.join(os.tmpdir(), 'achieveme-missing-dir-xyz'))
  assert.equal(files.length, 0)
})

test('walkDirsBounded respects depth cap and skip', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-walk-'))
  try {
    const deep = path.join(tmp, 'a', 'b', 'c', 'd', 'e')
    fs.mkdirSync(deep, { recursive: true })
    fs.mkdirSync(path.join(tmp, 'node_modules', 'pkg'), { recursive: true })
    fs.mkdirSync(path.join(tmp, 'keep'), { recursive: true })

    const dirs = walkDirsBounded(tmp, {
      maxDepth: 2,
      shouldSkip: (name) => name.toLowerCase() === 'node_modules'
    })
    const rels = dirs.map((d) => path.relative(tmp, d).replace(/\\/g, '/')).sort()
    assert.ok(rels.includes(''))
    assert.ok(rels.includes('a'))
    assert.ok(rels.includes('a/b'))
    assert.ok(rels.includes('keep'))
    assert.ok(!rels.some((r) => r.includes('node_modules')))
    assert.ok(!rels.includes('a/b/c'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('walkDirsBounded respects maxDirs visit cap', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'achieveme-walk-cap-'))
  try {
    for (let i = 0; i < 10; i++) {
      fs.mkdirSync(path.join(tmp, `d${i}`), { recursive: true })
    }
    const dirs = walkDirsBounded(tmp, { maxDepth: 4, maxDirs: 5 })
    assert.ok(dirs.length <= 5)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
