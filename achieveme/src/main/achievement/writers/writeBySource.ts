import type { RawAchievement, SourceId } from '../../../shared/types'
import { writeGoldbergSave } from './goldbergWriter'

const GOLDBERG_FAMILY: SourceId[] = ['goldberg', 'gse']

export function writeSaveBySource(
  source: SourceId,
  filePath: string,
  progress: Record<string, RawAchievement>
): void {
  if (!GOLDBERG_FAMILY.includes(source)) {
    throw new Error(`Write not supported for source: ${source}`)
  }
  writeGoldbergSave(filePath, progress)
}
