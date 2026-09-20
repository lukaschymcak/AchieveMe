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

test('addCustomGameFilePath creates extend game when title is new', () => {
  const next = addCustomGameFilePath(fixture, 'Balatro', 'E:\\Saves\\Balatro')
  const paths = listCustomGameFilePaths(next, 'Balatro')
  assert.deepEqual(paths, ['E:/Saves/Balatro'])
  assert.match(next, /name:\s*"Balatro"/)
  assert.match(next, /integration:\s*extend/)
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

test('syncGseSavesToLudusavi registers existing save folders idempotently', async () => {
  const { syncGseSavesToLudusavi, listLudusaviGuiCustomPaths } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviCustomGames.ts')).href
  )
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ludusavi-sync-gse-'))
  const guiFile = path.join(base, 'config.yaml')
  fs.writeFileSync(guiFile, fixture, 'utf8')
  const gseDir = path.join(base, '2638890')
  fs.mkdirSync(gseDir)

  try {
    // Missing config or empty folders returns ok with empty added
    assert.deepEqual(syncGseSavesToLudusavi('2638890', 'Onimusha: Way of the Sword', [], guiFile), {
      ok: true,
      added: []
    })
    assert.deepEqual(syncGseSavesToLudusavi('2638890', 'Onimusha: Way of the Sword', [gseDir], null), {
      ok: true,
      added: []
    })

    // First sync adds the folder
    const firstSync = syncGseSavesToLudusavi('2638890', 'Onimusha: Way of the Sword', [gseDir], guiFile)
    assert.equal(firstSync.ok, true)
    assert.equal(firstSync.added.length, 1)

    const listed = listLudusaviGuiCustomPaths(guiFile, 'Onimusha: Way of the Sword')
    assert.ok(listed.some((p) => p.toLowerCase() === gseDir.replace(/\\/g, '/').toLowerCase()))

    // Second sync is idempotent
    const secondSync = syncGseSavesToLudusavi('2638890', 'Onimusha: Way of the Sword', [gseDir], guiFile)
    assert.equal(secondSync.ok, true)
    assert.equal(secondSync.added.length, 1)

    const listedAfter = listLudusaviGuiCustomPaths(guiFile, 'Onimusha: Way of the Sword')
    // No duplicate entries
    const matching = listedAfter.filter(
      (p) => p.toLowerCase() === gseDir.replace(/\\/g, '/').toLowerCase()
    )
    assert.equal(matching.length, 1)
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('getGseSaveFoldersForAppid returns existing folders and skips missing', async () => {
  const { getGseSaveFoldersForAppid } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/savePathUtils.ts')).href
  )
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'save-folders-test-'))
  const customWatch = path.join(base, 'CustomSaves')
  const customAppidDir = path.join(customWatch, '12345')
  fs.mkdirSync(customAppidDir, { recursive: true })

  try {
    const settings = {
      customWatchFolders: [customWatch]
    }
    const found = getGseSaveFoldersForAppid('12345', settings)
    assert.ok(found.some((p) => p.toLowerCase() === customAppidDir.toLowerCase()))

    // Non-existent appid returns empty
    const notFound = getGseSaveFoldersForAppid('999999999', settings)
    assert.equal(notFound.length, 0)
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
})

test('addCustomGameFilePath properly replaces customGames: [] without creating duplicates', async () => {
  const { addCustomGameFilePath } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviCustomGames.ts')).href
  )
  const yamlWithEmpty = [
    'backup:',
    '  path: "C:/Users/Luky/ludusavi-backup"',
    'customGames: []',
    'apps:',
    '  rclone:',
    '    path: ""'
  ].join('\n')

  const updated = addCustomGameFilePath(
    yamlWithEmpty,
    'Onimusha: Way of the Sword',
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890'
  )

  // Must have exactly one customGames: occurrence
  const matches = updated.match(/customGames:/g) || []
  assert.equal(matches.length, 1)
  assert.equal(updated.includes('customGames: []'), false)
  assert.match(updated, /name: "Onimusha: Way of the Sword"/)
})

test('cleanCustomGamesYaml and addCustomGameFilePath heal duplicate customGames: sections', async () => {
  const { cleanCustomGamesYaml, addCustomGameFilePath, listCustomGameFilePaths } = await import(
    pathToFileURL(path.join(rootDir, '../src/main/achievement/ludusaviCustomGames.ts')).href
  )
  const duplicatedYaml = [
    'backup:',
    '  path: "C:/Users/Luky/ludusavi-backup"',
    'customGames: []',
    'customGames:',
    '  - name: "Dragon\'s Dogma 2"',
    '    integration: merge',
    '    files:',
    '      - "C:/Users/Luky/AppData/Roaming/GSE Saves/2054970"',
    '    registry: []',
    '    installDir: []',
    '    winePrefix: []'
  ].join('\n')

  // cleanCustomGamesYaml collapses into 1 section
  const cleaned = cleanCustomGamesYaml(duplicatedYaml)
  const cleanedMatches = cleaned.match(/customGames:/g) || []
  assert.equal(cleanedMatches.length, 1)
  assert.deepEqual(listCustomGameFilePaths(cleaned, "Dragon's Dogma 2"), [
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2054970'
  ])

  // addCustomGameFilePath also heals the duplication while adding a second game
  const withBoth = addCustomGameFilePath(
    duplicatedYaml,
    'Onimusha: Way of the Sword',
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890'
  )
  const withBothMatches = withBoth.match(/customGames:/g) || []
  assert.equal(withBothMatches.length, 1)
  assert.deepEqual(listCustomGameFilePaths(withBoth, "Dragon's Dogma 2"), [
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2054970'
  ])
  assert.deepEqual(listCustomGameFilePaths(withBoth, 'Onimusha: Way of the Sword'), [
    'C:/Users/Luky/AppData/Roaming/GSE Saves/2638890'
  ])
})


