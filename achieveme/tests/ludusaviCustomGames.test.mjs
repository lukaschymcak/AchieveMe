import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  addCustomGameFilePath,
  isSafeLudusaviCustomPath,
  listCustomGameFilePaths,
  normalizeLudusaviCustomPath,
  removeCustomGameFilePath
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviCustomGames.ts')).href
)

const fixture = [
  'backup:',
  '  path: "C:/Users/Luky/ludusavi-backup"',
  'customGames:',
  '  - name: "Dragon\'s Dogma 2"',
  '    integration: override',
  '    files:',
  '      - "<base>/config.ini"',
  '      - "C:\\\\Users\\\\Public\\\\Documents\\\\Steam\\\\RUNE\\\\2054970\\\\remote\\\\win64_save"',
  '    registry: []',
  '  - name: "Onimusha: Way of the Sword"',
  '    integration: override',
  '    files:',
  '      - "C:\\\\Users\\\\Luky\\\\AppData\\\\Roaming\\\\GSE Saves\\\\2638890\\\\remote\\\\win64_save"',
  '    registry: []',
  'apps:',
  '  rclone:',
  '    path: ""',
  ''
].join('\n')

test('normalizeLudusaviCustomPath uses forward slashes', () => {
  assert.equal(
    normalizeLudusaviCustomPath('C:\\Users\\Luky\\saves'),
    'C:/Users/Luky/saves'
  )
})

test('isSafeLudusaviCustomPath rejects empty and injection', () => {
  assert.equal(isSafeLudusaviCustomPath(''), false)
  assert.equal(isSafeLudusaviCustomPath('relative/path'), false)
  assert.equal(isSafeLudusaviCustomPath('C:/ok/saves'), true)
  assert.equal(isSafeLudusaviCustomPath('C:\\ok\\saves'), true)
})

test('listCustomGameFilePaths reads Onimusha files', () => {
  const paths = listCustomGameFilePaths(fixture, 'Onimusha: Way of the Sword')
  assert.deepEqual(paths, [
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890/remote/win64_save'
  ])
})

test('addCustomGameFilePath appends to existing override game', () => {
  const next = addCustomGameFilePath(
    fixture,
    'Onimusha: Way of the Sword',
    'D:\\Extra\\OnimushaSaves'
  )
  const paths = listCustomGameFilePaths(next, 'Onimusha: Way of the Sword')
  assert.equal(paths.length, 2)
  assert.ok(paths.includes('D:/Extra/OnimushaSaves'))
  assert.match(next, /integration:\s*override/)
  assert.match(next, /Dragon's Dogma 2/)
})

test('addCustomGameFilePath is idempotent', () => {
  const once = addCustomGameFilePath(
    fixture,
    'Onimusha: Way of the Sword',
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890/remote/win64_save'
  )
  assert.equal(once, fixture)
})

test('addCustomGameFilePath creates merge game when title is new', () => {
  const next = addCustomGameFilePath(fixture, 'Balatro', 'E:\\Saves\\Balatro')
  const paths = listCustomGameFilePaths(next, 'Balatro')
  assert.deepEqual(paths, ['E:/Saves/Balatro'])
  assert.match(next, /name:\s*"Balatro"/)
  assert.match(next, /integration:\s*merge/)
})

test('addCustomGameFilePath creates customGames block when missing', () => {
  const next = addCustomGameFilePath('backup:\n  path: C:/b\n', 'Balatro', 'E:/Saves/Balatro')
  assert.match(next, /customGames:/)
  assert.deepEqual(listCustomGameFilePaths(next, 'Balatro'), ['E:/Saves/Balatro'])
})

test('removeCustomGameFilePath drops one file and keeps the game', () => {
  const withTwo = addCustomGameFilePath(
    fixture,
    'Onimusha: Way of the Sword',
    'D:/Extra/OnimushaSaves'
  )
  const next = removeCustomGameFilePath(
    withTwo,
    'Onimusha: Way of the Sword',
    'D:/Extra/OnimushaSaves'
  )
  assert.deepEqual(listCustomGameFilePaths(next, 'Onimusha: Way of the Sword'), [
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890/remote/win64_save'
  ])
})

test('removeCustomGameFilePath drops the custom game when last file is gone', () => {
  const next = removeCustomGameFilePath(
    fixture,
    'Onimusha: Way of the Sword',
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890/remote/win64_save'
  )
  assert.deepEqual(listCustomGameFilePaths(next, 'Onimusha: Way of the Sword'), [])
  assert.doesNotMatch(next, /Onimusha: Way of the Sword/)
  assert.match(next, /Dragon's Dogma 2/)
})

test('write helpers persist custom path into a GUI config file', async () => {
  const {
    addLudusaviGuiCustomPath,
    listLudusaviGuiCustomPaths,
    removeLudusaviGuiCustomPath
  } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviCustomGames.ts')).href
  )
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-gui-custom-'))
  const guiFile = path.join(base, 'config.yaml')
  fs.writeFileSync(guiFile, fixture, 'utf8')
  const folder = path.join(base, 'extra-saves')
  fs.mkdirSync(folder)
  try {
    const added = addLudusaviGuiCustomPath(guiFile, 'Onimusha: Way of the Sword', folder)
    assert.equal(added.ok, true)
    assert.ok(added.paths.some((p) => p.replace(/\\/g, '/') === folder.replace(/\\/g, '/')))
    const listed = listLudusaviGuiCustomPaths(guiFile, 'Onimusha: Way of the Sword')
    assert.deepEqual(listed, added.paths)
    const removed = removeLudusaviGuiCustomPath(guiFile, 'Onimusha: Way of the Sword', folder)
    assert.equal(removed.ok, true)
    assert.equal(
      removed.paths.some((p) => p.replace(/\\/g, '/') === folder.replace(/\\/g, '/')),
      false
    )
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})
