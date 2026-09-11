import fs from 'node:fs'
import path from 'node:path'

/**
 * Normalizes a Ludusavi custom file/folder path to forward slashes.
 *
 * @param filePath - Absolute save file or folder path.
 */
export function normalizeLudusaviCustomPath(filePath: string): string {
  return String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
}

/**
 * Returns true when a custom save path is safe to store in Ludusavi YAML.
 *
 * @param filePath - Candidate path.
 */
export function isSafeLudusaviCustomPath(filePath: string): boolean {
  const clean = String(filePath || '').trim()
  if (!clean || clean.length > 400) return false
  if (/[\0\r\n]/.test(clean)) return false
  const normalized = normalizeLudusaviCustomPath(clean)
  return path.win32.isAbsolute(normalized) || path.posix.isAbsolute(normalized)
}

function unescapeYamlScalar(raw: string): string {
  let value = String(raw || '').trim()
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1)
  }
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function yamlQuotePath(filePath: string): string {
  const normalized = normalizeLudusaviCustomPath(filePath).replace(/"/g, '\\"')
  return `"${normalized}"`
}

function pathsEqual(a: string, b: string): boolean {
  return normalizeLudusaviCustomPath(a).toLowerCase() === normalizeLudusaviCustomPath(b).toLowerCase()
}

function splitCustomGamesSection(configYaml: string): {
  before: string
  body: string
  after: string
} | null {
  const text = String(configYaml || '')
  const match = /(?:^|\n)customGames:\s*(?:\r?\n|$)/.exec(text)
  if (!match || match.index === undefined) return null
  const headerAt = match.index + (match[0].startsWith('\n') ? 1 : 0)
  const bodyStart = match.index + match[0].length
  const rest = text.slice(bodyStart)
  const nextKey = rest.search(/\n[a-zA-Z][\w]*:/)
  const body = nextKey >= 0 ? rest.slice(0, nextKey) : rest
  const after = nextKey >= 0 ? rest.slice(nextKey) : ''
  return {
    before: text.slice(0, headerAt),
    body,
    after
  }
}

type CustomGameEntry = {
  name: string
  raw: string
}

function parseCustomGameEntries(body: string): CustomGameEntry[] {
  const text = String(body || '')
  const starts: number[] = []
  const re = /^  - name:\s*/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    starts.push(match.index)
  }
  if (starts.length === 0) return []
  const out: CustomGameEntry[] = []
  for (let i = 0; i < starts.length; i += 1) {
    const raw = text.slice(starts[i], starts[i + 1])
    const nameLine = /^  - name:\s*(.+)\s*$/m.exec(raw)
    const name = unescapeYamlScalar(nameLine?.[1] || '')
    if (!name) continue
    out.push({ name, raw })
  }
  return out
}

function listFilesFromGameRaw(raw: string): string[] {
  const filesIdx = raw.search(/^    files:\s*$/m)
  if (filesIdx < 0) {
    if (/^    files:\s*\[\s*\]\s*$/m.test(raw)) return []
    return []
  }
  const after = raw.slice(filesIdx)
  const lines = after.split(/\r?\n/)
  const paths: string[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    const item = /^      -\s*(.+)\s*$/.exec(line)
    if (item) {
      const value = unescapeYamlScalar(item[1])
      if (value) paths.push(normalizeLudusaviCustomPath(value))
      continue
    }
    if (/^    [a-zA-Z]/.test(line) || /^  - name:/.test(line)) break
    if (!line.trim()) continue
    break
  }
  return paths
}

function rebuildCustomGamesYaml(before: string, entries: CustomGameEntry[], after: string): string {
  const body =
    entries.length === 0
      ? 'customGames: []\n'
      : `customGames:\n${entries.map((e) => e.raw.replace(/\s*$/, '')).join('\n')}\n`
  return `${before.replace(/\s*$/, '\n')}${body}${after.replace(/^\n/, '')}`
}

/**
 * Lists `customGames[].files` for an exact Ludusavi title.
 *
 * @param configYaml - Full Ludusavi config.yaml text.
 * @param title - Exact Ludusavi game title.
 */
export function listCustomGameFilePaths(configYaml: string, title: string): string[] {
  const wanted = String(title || '').trim()
  if (!wanted) return []
  const section = splitCustomGamesSection(configYaml)
  if (!section) return []
  const game = parseCustomGameEntries(section.body).find((g) => g.name === wanted)
  return game ? listFilesFromGameRaw(game.raw) : []
}

function appendFileToGameRaw(raw: string, filePath: string): string {
  const quoted = yamlQuotePath(filePath)
  const item = `      - ${quoted}`
  if (/^    files:\s*\[\s*\]\s*$/m.test(raw)) {
    return raw.replace(/^    files:\s*\[\s*\]\s*$/m, `    files:\n${item}`)
  }
  const filesIdx = raw.search(/^    files:\s*$/m)
  if (filesIdx < 0) {
    const trimmed = raw.replace(/\s*$/, '')
    return `${trimmed}\n    files:\n${item}\n`
  }
  const afterHeader = raw.slice(filesIdx)
  const headerLine = afterHeader.split(/\r?\n/, 1)[0] ?? '    files:'
  const rest = afterHeader.slice(headerLine.length).replace(/^\r?\n/, '')
  const restLines = rest.split(/\r?\n/)
  const fileLines: string[] = []
  let i = 0
  for (; i < restLines.length; i += 1) {
    if (/^      -\s*/.test(restLines[i])) {
      fileLines.push(restLines[i])
      continue
    }
    break
  }
  const tail = restLines.slice(i).join('\n')
  const nextFiles = [...fileLines, item].join('\n')
  const head = raw.slice(0, filesIdx)
  return `${head}${headerLine}\n${nextFiles}${tail ? `\n${tail}` : ''}`
}

function dropFileFromGameRaw(raw: string, filePath: string): string {
  const lines = raw.split(/\r?\n/)
  const kept: string[] = []
  let inFiles = false
  let removed = false
  for (const line of lines) {
    if (/^    files:\s*$/.test(line) || /^    files:\s*\[\s*\]\s*$/.test(line)) {
      inFiles = true
      kept.push(line)
      continue
    }
    if (inFiles && /^      -\s*(.+)\s*$/.test(line)) {
      const value = unescapeYamlScalar(RegExp.$1)
      if (!removed && pathsEqual(value, filePath)) {
        removed = true
        continue
      }
      kept.push(line)
      continue
    }
    if (inFiles && (/^    [a-zA-Z]/.test(line) || /^  - name:/.test(line))) {
      inFiles = false
    }
    kept.push(line)
  }
  return kept.join('\n')
}

function newCustomGameRaw(title: string, filePath: string): string {
  const quotedName = `"${String(title).replace(/"/g, '\\"')}"`
  return [
    `  - name: ${quotedName}`,
    '    integration: merge',
    '    files:',
    `      - ${yamlQuotePath(filePath)}`,
    '    registry: []',
    '    installDir: []',
    '    winePrefix: []'
  ].join('\n')
}

/**
 * Adds a custom save path for a title. Existing `integration` is preserved.
 * New games use `integration: merge` so the Ludusavi manifest is not wiped.
 *
 * @param configYaml - Full config.yaml text.
 * @param title - Exact Ludusavi game title.
 * @param filePath - Absolute folder or file path.
 */
export function addCustomGameFilePath(configYaml: string, title: string, filePath: string): string {
  const wanted = String(title || '').trim()
  if (!wanted || !isSafeLudusaviCustomPath(filePath)) {
    return String(configYaml || '')
  }
  const normalized = normalizeLudusaviCustomPath(filePath)
  const existing = listCustomGameFilePaths(configYaml, wanted)
  if (existing.some((p) => pathsEqual(p, normalized))) {
    return String(configYaml || '')
  }

  const section = splitCustomGamesSection(configYaml)
  if (!section) {
    const trimmed = String(configYaml || '').replace(/\s*$/, '')
    const block = `customGames:\n${newCustomGameRaw(wanted, normalized)}\n`
    return trimmed ? `${trimmed}\n${block}` : block
  }

  const entries = parseCustomGameEntries(section.body)
  const idx = entries.findIndex((g) => g.name === wanted)
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], raw: appendFileToGameRaw(entries[idx].raw, normalized) }
  } else {
    entries.push({ name: wanted, raw: newCustomGameRaw(wanted, normalized) })
  }
  return rebuildCustomGamesYaml(section.before, entries, section.after)
}

/**
 * Removes a custom save path. Drops the whole custom game when no files remain.
 *
 * @param configYaml - Full config.yaml text.
 * @param title - Exact Ludusavi game title.
 * @param filePath - Path to remove (slash style does not matter).
 */
export function removeCustomGameFilePath(
  configYaml: string,
  title: string,
  filePath: string
): string {
  const wanted = String(title || '').trim()
  const normalized = normalizeLudusaviCustomPath(filePath)
  if (!wanted || !normalized) return String(configYaml || '')
  const section = splitCustomGamesSection(configYaml)
  if (!section) return String(configYaml || '')
  const entries = parseCustomGameEntries(section.body)
  const next: CustomGameEntry[] = []
  for (const entry of entries) {
    if (entry.name !== wanted) {
      next.push(entry)
      continue
    }
    const updated = dropFileFromGameRaw(entry.raw, normalized)
    const files = listFilesFromGameRaw(updated)
    if (files.length === 0) continue
    next.push({ name: entry.name, raw: updated })
  }
  return rebuildCustomGamesYaml(section.before, next, section.after)
}

export type LudusaviGuiCustomPathResult = {
  ok: boolean
  paths: string[]
  error?: string
}

/**
 * Lists custom save paths from a Ludusavi GUI config.yaml file.
 *
 * @param configPath - Absolute path to config.yaml.
 * @param title - Exact Ludusavi game title.
 */
export function listLudusaviGuiCustomPaths(configPath: string, title: string): string[] {
  const file = String(configPath || '').trim()
  if (!file || !fs.existsSync(file)) return []
  try {
    return listCustomGameFilePaths(fs.readFileSync(file, 'utf8'), title)
  } catch {
    return []
  }
}

/**
 * Adds a custom save folder to the Ludusavi GUI config.yaml.
 *
 * @param configPath - Absolute path to config.yaml.
 * @param title - Exact Ludusavi game title.
 * @param folder - Absolute folder path that exists.
 */
export function addLudusaviGuiCustomPath(
  configPath: string,
  title: string,
  folder: string
): LudusaviGuiCustomPathResult {
  const file = String(configPath || '').trim()
  const wanted = String(title || '').trim()
  if (!file || !wanted) return { ok: false, paths: [], error: 'Ludusavi config or title is missing.' }
  if (!isSafeLudusaviCustomPath(folder)) {
    return { ok: false, paths: [], error: 'Invalid folder path.' }
  }
  try {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      return { ok: false, paths: [], error: 'Folder was not found.' }
    }
    if (!fs.existsSync(file)) {
      return { ok: false, paths: [], error: 'Ludusavi config.yaml was not found. Open ludusavi.exe once.' }
    }
    const prev = fs.readFileSync(file, 'utf8')
    const next = addCustomGameFilePath(prev, wanted, folder)
    fs.writeFileSync(file, next, 'utf8')
    return { ok: true, paths: listCustomGameFilePaths(next, wanted) }
  } catch (err) {
    return { ok: false, paths: [], error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Removes a custom save path from the Ludusavi GUI config.yaml.
 *
 * @param configPath - Absolute path to config.yaml.
 * @param title - Exact Ludusavi game title.
 * @param folder - Path to remove.
 */
export function removeLudusaviGuiCustomPath(
  configPath: string,
  title: string,
  folder: string
): LudusaviGuiCustomPathResult {
  const file = String(configPath || '').trim()
  const wanted = String(title || '').trim()
  if (!file || !wanted) return { ok: false, paths: [], error: 'Ludusavi config or title is missing.' }
  try {
    if (!fs.existsSync(file)) {
      return { ok: false, paths: [], error: 'Ludusavi config.yaml was not found.' }
    }
    const prev = fs.readFileSync(file, 'utf8')
    const next = removeCustomGameFilePath(prev, wanted, folder)
    fs.writeFileSync(file, next, 'utf8')
    return { ok: true, paths: listCustomGameFilePaths(next, wanted) }
  } catch (err) {
    return { ok: false, paths: [], error: err instanceof Error ? err.message : String(err) }
  }
}
