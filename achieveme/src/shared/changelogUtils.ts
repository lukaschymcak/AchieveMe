import type { PendingChangelog } from './types'

export type ChangelogLineType =
  | 'feat'
  | 'fix'
  | 'perf'
  | 'refactor'
  | 'docs'
  | 'style'
  | 'test'
  | 'chore'
  | 'build'
  | 'bullet'
  | 'text'

export interface ParsedChangelogItem {
  id: string
  type: ChangelogLineType
  tag?: string
  scope?: string
  text: string
}

const COMMIT_TYPE_REGEX = /^(feat|fix|perf|refactor|docs|style|test|chore|build)(?:\(([^)]+)\))?:\s*(.+)$/i
const BULLET_REGEX = /^[-*]\s+(.+)$/

/**
 * Parses raw release notes or commit messages into structured items
 * suitable for rendering with badges and tidy spacing.
 */
export function parseChangelogNotes(notes: string): ParsedChangelogItem[] {
  if (!notes || typeof notes !== 'string') return []
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, idx) => {
    // Strip leading markdown bullets like "- feat: ..." or "* fix: ..."
    let stripped = line
    const bulletMatch = line.match(BULLET_REGEX)
    if (bulletMatch) {
      stripped = bulletMatch[1].trim()
    }

    const commitMatch = stripped.match(COMMIT_TYPE_REGEX)
    if (commitMatch) {
      const tag = commitMatch[1].toLowerCase() as ChangelogLineType
      const scope = commitMatch[2]?.trim()
      const text = commitMatch[3].trim()
      return {
        id: `cl-${idx}`,
        type: tag,
        tag,
        scope,
        text
      }
    }

    if (bulletMatch) {
      return {
        id: `cl-${idx}`,
        type: 'bullet',
        text: stripped
      }
    }

    return {
      id: `cl-${idx}`,
      type: 'text',
      text: line
    }
  })
}

/**
 * Validates and matches a pending changelog against the current running app version.
 * Returns the validated PendingChangelog if matching, otherwise null.
 */
export function resolvePendingChangelog(
  rawJson: string | null | undefined,
  currentVersion: string
): PendingChangelog | null {
  if (!rawJson) return null
  try {
    const data = JSON.parse(rawJson) as PendingChangelog
    if (!data || typeof data !== 'object') return null
    if (!data.version || typeof data.version !== 'string') return null
    if (!data.notes || typeof data.notes !== 'string' || !data.notes.trim()) return null

    const v1 = data.version.replace(/^v/, '').trim()
    const v2 = (currentVersion || '').replace(/^v/, '').trim()
    if (v1 !== v2) {
      return null
    }

    return {
      version: data.version,
      notes: data.notes.trim(),
      releaseDate: data.releaseDate
    }
  } catch {
    return null
  }
}
