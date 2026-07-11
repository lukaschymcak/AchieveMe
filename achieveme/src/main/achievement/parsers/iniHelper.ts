import fs from 'node:fs'

// Returns a map of { sectionName -> { key -> value } }
export function parseIniFile(filePath: string): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>()

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return result
  }

  // Track sections by their lowercase name but preserve original casing as the key
  const byLower = new Map<string, { canon: string; keys: Map<string, string> }>()
  const order: string[] = []

  let current: Map<string, string> | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionName = line.slice(1, -1).trim()
      const lower = sectionName.toLowerCase()
      if (!byLower.has(lower)) {
        const keys = new Map<string, string>()
        byLower.set(lower, { canon: sectionName, keys })
        order.push(lower)
        current = keys
      } else {
        current = byLower.get(lower)!.keys
      }
      continue
    }

    if (!current) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim().toLowerCase()
    const value = line.slice(eq + 1).trim()
    current.set(key, value) // last value wins
  }

  for (const lower of order) {
    const entry = byLower.get(lower)!
    result.set(entry.canon, entry.keys)
  }

  return result
}

// Case-insensitive section lookup
export function getIniSection(
  ini: Map<string, Map<string, string>>,
  section: string
): Map<string, string> | undefined {
  const lower = section.toLowerCase()
  for (const [name, keys] of ini) {
    if (name.toLowerCase() === lower) return keys
  }
  return undefined
}

// Case-insensitive key lookup within a section
export function iniKeyGet(keys: Map<string, string>, key: string): string | undefined {
  return keys.get(key.toLowerCase())
}
