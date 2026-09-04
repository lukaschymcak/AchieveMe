/**
 * Steamless wizard game-pick / exe-list decisions (pure, no Electron).
 * Always lists folder executables like Play → Select executable.
 */

export type SteamlessGamePickAction = 'list-exes' | 'browse'

export type SteamlessExeStep = { kind: 'show-picker' }

/**
 * After the user picks a library game, decide how to get an exe list.
 * Saved launch_exe is ignored so a previous unpack cannot be auto-targeted.
 *
 * @param game - Library row with optional install path and launch exe.
 */
export function steamlessGamePickAction(game: {
  install_path?: string
  launch_exe?: string
}): SteamlessGamePickAction {
  if (game.install_path?.trim()) return 'list-exes'
  return 'browse'
}

/**
 * After folder resolve, Steamless always shows the exe picker (never auto-unpacks
 * a single hit such as Game.exe.unpacked.exe).
 *
 * @param _executables - Exes from resolveGameExecutables / listInstallExecutables.
 */
export function steamlessExeStep(
  executables: ReadonlyArray<{ absolutePath: string }>
): SteamlessExeStep {
  void executables
  return { kind: 'show-picker' }
}
