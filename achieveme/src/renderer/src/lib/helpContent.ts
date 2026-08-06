import type { SourceId } from '../../../shared/types'

export const HELP_STORAGE_KEYS = {
  firstRunSeen: 'achieveme-first-run-seen',
  longPressHintSeen: 'achieveme-long-press-hint-seen'
} as const

export interface EmulatorSourceHelp {
  id: SourceId
  defaultPath: string
  fileName: string
  notes?: string
}

export const EMULATOR_SOURCES: EmulatorSourceHelp[] = [
  {
    id: 'goldberg',
    defaultPath: '%APPDATA%\\Goldberg SteamEmu Saves',
    fileName: 'achievements.json',
    notes: 'Backup, delete, and write-back supported.'
  },
  {
    id: 'gse',
    defaultPath: '%APPDATA%\\GSE Saves',
    fileName: 'achievements.json',
    notes: 'Backup, delete, and write-back supported.'
  },
  {
    id: 'codex',
    defaultPath: '%PUBLIC%\\Documents\\Steam\\CODEX',
    fileName: 'achievements.ini'
  },
  {
    id: 'rune',
    defaultPath: '%PUBLIC%\\Documents\\Steam\\RUNE',
    fileName: 'achievements.ini'
  }
]

export const TOOLTIPS = {
  refreshLibrary:
    'Rescan all emulator folders, re-read save files, refetch Steam metadata, and remove games whose saves are gone. Updates the entire library.',
  refreshGameDetail:
    'Rescan and refresh the entire library (not just this game). Hold a library card for per-game refresh.',
  refreshGameMenu: 'Re-read this game’s save files and refetch Steam metadata for this title only.',
  sortLeast: 'Sort by lowest completion percentage first.',
  sortMost: 'Sort by most unlocked achievements first.',
  sortRecent: 'Sort by most recently unlocked achievement first.',
  addGame:
    'Set up Goldberg files for a new game (search, pick steam_api.dll, optionally apply the emulator DLL).',
  gridList: 'Switch between grid and list layout. Your choice is remembered.',
  playGamesFromLauncher:
    'When checked, game detail shows Set install folder / Select exe / Play so you can launch games from AchieveMe.',
  search: 'Filter games by name. Sort order is preserved.',
  level: 'Level = floor(XP ÷ 1000). Earn XP from unlocked achievements.',
  xp: 'Bronze 50 · Silver 100 · Gold 200 · Platinum (100% game) 500 XP per trophy.',
  platinumStat: 'Number of games at 100% completion.',
  goldStat: 'Earned achievements with global rarity under 20% of Steam players.',
  silverStat: 'Earned achievements with 20–40% global rarity.',
  bronzeStat: 'Earned achievements with 40%+ global rarity.',
  gamesStat: 'Total games in your library.',
  unlockedStat: 'Total earned achievements across all games.',
  monthlyActivity: 'Unlock counts grouped by month from save file timestamps.',
  libraryCompletion: 'Average completion percentage across games that have achievements.',
  unlocksPerGame: 'Total unlocked achievements divided by games in your library.',
  playtimeStat:
    'Tracked playtime for games added via Add Game when their install-folder .exe is running.',
  hiddenFilter:
    'Toggle descriptions for unearned hidden achievements. Earned hidden achievements always show their text.',
  tierFilter: 'Filter the list by trophy tier. Counts show how many you have earned in that tier.',
  navArrows: 'Browse games in your library’s current sort and search order.',
  completionRing: 'Progress from merged emulator save data across all enabled sources.',
  settingsApiKey:
    'Required for achievement names, icons, and hidden flags. Cover art and global unlock % work without a key.',
  settingsSources:
    'Only enabled sources are scanned. Goldberg and GSE support backup, delete, and write-back.',
  settingsCustomFolders:
    'Extra roots scanned for every enabled source. Use for non-standard install paths.',
  settingsBackup:
    'Export includes Goldberg/GSE saves and library metadata. Import merges file-by-file without deleting other games.',
  settingsSteamless:
    'Link a Steamless release folder that contains Steamless.CLI.exe and Plugins. Used from Tools → Steamless. Not bundled with AchieveMe.',
  settingsNotifications:
    'Unlock toasts use a Steam-style layout with bronze/silver/gold accents by rarity, plus a platinum toast when a game first hits 100%. They fire on live save changes only. Optional sound uses the Windows default chime or a custom .wav/.mp3 with adjustable volume.',
  settingsTray:
    'Close the window to keep AchieveMe in the system tray while it watches save folders. Optionally launch when Windows starts, and start minimized to the tray on login only.',
  settingsPlaySessions:
    'Playtime is tracked when a known game executable under the resolved game folder is running. Session recap appears under Notifications.',
  settingsPlaytime:
    'Playtime is tracked when a known game executable under the resolved game folder (climbed from the Add Game DLL path) is running.',
  settingsSessionRecap:
    'After a tracked play session of at least one minute, AchieveMe shows time played, unlocks, and XP gained.'
} as const

export const EMPTY_STATES = {
  noGames: {
    title: 'No games found yet',
    body: 'AchieveMe discovers games automatically by scanning emulator save folders. Each game needs a numeric Steam App ID folder with an achievement file inside (for example Goldberg\\123456\\achievements.json). Check Settings → Emulator Sources, confirm your save paths exist, then click Refresh.'
  },
  noSearchMatch: 'No games match your search.',
  noMonthlyActivity:
    'Unlock achievements in your games — monthly totals come from save file timestamps. Open Library and click Refresh to resync.',
  /** @deprecated Prefer getEmptyAchievementsMessage — kept for callers that only need a generic fallback. */
  noAchievements:
    'No achievements loaded for this game. Add a Steam API key in Settings if missing, then Refresh the library. The list comes from Steam schema (cached after the first successful fetch), not from emulator save files. If the game has no Steam achievements, the list will stay empty.',
  noAchievementsNeedApiKey:
    'No achievements loaded. Add a Steam Web API key in Settings, then Refresh the library. The list comes from Steam schema, not from emulator save files.',
  noAchievementsFromSteam:
    'Steam has no published achievement schema for this game yet. The store may list Achievements before stats go live (common for unreleased or newly launched titles). Try Refresh again later.',
  noAchievementsFetchFailed:
    'Could not load Steam achievement schema for this game. Check your API key and network connection, then Refresh.',
  noApiKeyExtra:
    'Cover art and global unlock percentages still load without a key. You can also set the key in Settings — remember to click Refresh in Library after saving there.'
} as const

/**
 * Picks the empty achievement-list message for game detail.
 *
 * @param hasApiKey - Whether Settings has a non-empty Steam Web API key.
 * @param schemaFetchedAt - Unix seconds when schema was last successfully applied (0 = never).
 */
export function getEmptyAchievementsMessage(hasApiKey: boolean, schemaFetchedAt: number): string {
  if (!hasApiKey) return EMPTY_STATES.noAchievementsNeedApiKey
  if (schemaFetchedAt > 0) return EMPTY_STATES.noAchievementsFromSteam
  return EMPTY_STATES.noAchievementsFetchFailed
}

export const FIRST_RUN = {
  title: 'Welcome to AchieveMe',
  intro:
    'AchieveMe tracks Steam achievements from emulator save files on your PC. It does not unlock achievements in games and is not a Steam client — progress comes from Goldberg, GSE, CODEX, and other save folders.',
  bullets: [
    'Set a Steam Web API key to show achievement names, icons, and descriptions.',
    'Games appear automatically when save folders are found — click Refresh to rescan.',
    'Progress updates live when save files change; use Refresh to force a full resync.',
    'Hold a library card (~0.5s) for per-game actions: Open, Refresh, or Delete.'
  ],
  dismiss: 'Got it'
} as const

export const LONG_PRESS_HINT = {
  title: 'Tip: long-press a game card',
  body: 'Click to open details. Hold about half a second for Open, Refresh (this game only), or Delete.',
  dismiss: 'Got it'
} as const

export const DELETE_CONFIRM =
  'Permanently removes this game from the library and deletes its Goldberg/GSE save folder from disk. CODEX and other read-only sources are not deleted.'

export const SETTINGS_HINTS = {
  apiKey:
    'Required for achievement display names, descriptions, icons, and hidden flags. Cover art and global unlock percentages work without a key.',
  apiKeySettingsNote: 'After saving here, open Library and click Refresh to rescan.',
  customFolders:
    'Extra roots scanned for every enabled source. Use for non-standard installs. Use the layout {appid}/{achievement file}, e.g. C:\\Saves\\570\\achievements.json.',
  backup:
    'Export: library metadata plus Goldberg/GSE appid folders and emulator settings. Does not include CODEX or RUNE saves. Import merges file-by-file and never deletes other games on disk. Custom watch folders must exist on the target PC or imports may warn and skip paths.',
  saveSuccess: 'Saved. Open Library and click Refresh to rescan for games.',
  importConfirm:
    'Import merges backup files into your emulator folders. Existing games not in the backup are left untouched. Continue?',
  notifications:
    'Steam-style unlock toasts (rarity accents; platinum at 100%) with optional sound and volume when new achievements appear in save files. Refresh and first library scan never trigger toasts.',
  tray:
    'Keep AchieveMe in the system tray after closing the window. Optionally launch on Windows startup and start minimized to the tray on login only.',
  playSessions:
    'Track playtime for games added via the Add Game wizard when their executable is running.',
  customSound:
    'Leave blank to use the Windows default unlock sound. Pick a .wav or .mp3 file for a custom chime. Click Save before Test notification so the new path and volume are used.',
  soundVolume: 'Unlock sound loudness from 0% (silent) to 100% (full). Disabled when Play sound is off.',
  testNotification:
    'Preview the Steam-style unlock toast anytime. Each click cycles bronze → silver → gold → platinum skins. Works even when unlock toasts are disabled; real unlocks still follow the checkbox above. Quit and relaunch still shows the preview.',
  testSessionRecap:
    'Opens a demo session recap for a random library game (fake duration and recent unlocks). Works even when session recap is disabled.',
  steamlessFolder:
    'Point to an extracted Steamless release (must include Steamless.CLI.exe and a Plugins folder). Configure here, then unpack games from Tools.'
} as const

export const ADD_GAME = {
  searchHelp:
    'Search by game name, paste a Steam store URL, or enter an App ID. This wizard sets up Goldberg emulator files — it does not add CODEX or other save types manually.',
  dllHelp:
    'Pick steam_api.dll or steam_api64.dll from the game install folder. Goldberg installs steam_settings beside it, replacing any existing folder.',
  emuHelp:
    'Replaces the game’s Steam API DLL with Goldberg so the game runs through the emulator. Your original DLL is saved as a .bak backup first. Leave this off if the game is already emulated or you only want achievement tracking files.',
  emuQuestion: 'Also apply the Goldberg emulator?',
  applyHelp:
    'Runs generate_emu_config, copies steam_settings, and seeds a 0% Goldberg save. If you opted in, it also installs the emulator DLL. After you play, progress appears automatically or via Refresh. Click Done, then Refresh the library.'
} as const

export interface HelpSection {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'about',
    title: 'What AchieveMe does',
    paragraphs: [
      'AchieveMe is a read-only achievement tracker for PC games using Steam emulator save formats. It watches save folders, merges progress, and enriches data with Steam metadata.',
      'It does not unlock achievements, modify games while you play, or sync with your Steam account login.'
    ]
  },
  {
    id: 'discovery',
    title: 'Where games come from',
    paragraphs: [
      'Games are discovered automatically from enabled emulator sources and custom watch folders. Each game must live at {emulator root}/{Steam App ID}/{achievement file} with a numeric App ID (e.g. 570, 1245620).',
      'If saves exist but the library is empty, check Settings → Emulator Sources and paths, then click Refresh in Library.'
    ]
  },
  {
    id: 'sources',
    title: 'Emulator sources',
    paragraphs: [
      'Goldberg and GSE saves support backup, delete, and write-back. CODEX and RUNE are read-only in AchieveMe.'
    ],
    bullets: EMULATOR_SOURCES.map(
      (s) =>
        `${s.id}: ${s.defaultPath} → ${s.fileName}${s.notes ? ` (${s.notes})` : ''}`
    )
  },
  {
    id: 'sync',
    title: 'Sync: automatic vs Refresh',
    paragraphs: [
      'The file watcher updates the library within about a second when achievement save files change on disk. No Refresh needed during normal play.',
      'Library Refresh rescans all sources, re-reads every save file, refetches Steam metadata (bypassing cache), and removes games whose saves are gone.',
      'Game detail Refresh does the same full-library sync. For one game only, long-press its card → Refresh.'
    ]
  },
  {
    id: 'api-key',
    title: 'Steam Web API key',
    paragraphs: [
      'The key loads achievement schema: display names, descriptions, icons, and hidden flags. That Steam schema is the achievement catalog; emulator saves only mark which ones you unlocked.',
      'Without a key (and with no prior cached schema), games still appear from save files but the achievement list stays empty. Cover art and global unlock percentages still load from public Steam endpoints. After a successful fetch, Refresh redownloads schema; if the network fails, the last cache is kept.',
      'Get a free key at steamcommunity.com/dev/apikey. Saving in Settings does not rescan — click Refresh in Library afterward.'
    ]
  },
  {
    id: 'library',
    title: 'Library',
    paragraphs: ['Click a card to open game details. Hold ~0.5 seconds for Open, Refresh, or Delete.'],
    bullets: [
      'Search — filter by game name',
      'Least / Most / Recent — sort by completion, unlock count, or last unlock',
      '+ Add game — Goldberg setup wizard for new titles',
      'Grid / list — layout preference, saved between sessions'
    ]
  },
  {
    id: 'notifications',
    title: 'Notifications',
    paragraphs: [
      'When a save file changes and a new achievement unlocks, AchieveMe shows a Steam-style toast (UNLOCKED! with bronze/silver/gold chrome by rarity). When a game first reaches 100%, a platinum celebration toast follows. Library Refresh and first launch never spam toasts for existing unlocks. Use Settings → Test notification to cycle through all four skins.',
      'Optional unlock sound uses the Windows default chime or a custom .wav/.mp3, with a volume slider. After a tracked Add Game play session of at least one minute, a session recap modal summarizes time played, unlocks, and XP. Use Settings → Test session recap to preview with a random library game.'
    ],
    bullets: [
      'Notifications — Steam-style unlock toasts on live save changes',
      'Rarity chrome — bronze / silver / gold by achievement tier; platinum at 100%',
      'Sound — default Windows chime or custom .wav/.mp3',
      'Volume — 0–100% unlock sound loudness',
      'Test notification — cycles rarity skins from Settings',
      'Session recap — modal after play with time, unlocks, and XP',
      'Test session recap — demo modal for a random library game'
    ]
  },
  {
    id: 'tray',
    title: 'Tray & startup',
    paragraphs: [
      'Close the window to hide AchieveMe in the system tray — it keeps watching save folders. Use Show from the tray icon to reopen.',
      'Optionally launch AchieveMe when Windows starts. With start minimized enabled, a login launch stays in the tray only; opening the app yourself still shows the window.'
    ],
    bullets: [
      'Close to tray — app stays running in the background',
      'Launch on startup — optional Windows login launch',
      'Start minimized on login — tray only when Windows starts the app'
    ]
  },
  {
    id: 'play-sessions',
    title: 'Play sessions',
    paragraphs: [
      'Playtime is tracked for games set up via Add Game when a known executable under the resolved game folder is running.'
    ],
    bullets: ['Playtime — tracks hours for games added via Add Game wizard']
  },
  {
    id: 'game-detail',
    title: 'Game detail',
    paragraphs: [
      'Completion reflects merged save data. The platinum row is earned at 100%. Tier filters show earned counts per rarity band.',
      'Unearned achievements with progress counters show a partial progress bar (Goldberg/GSE saves).',
      'Hidden toggle reveals descriptions for unearned hidden achievements only. Global rarity is Steam-wide, not friends-only.',
      'Edge arrows move through the library in your current sort/search order.'
    ]
  },
  {
    id: 'dashboard',
    title: 'Profile & scoring',
    paragraphs: ['Dashboard stats rebuild when your library changes.'],
    bullets: [
      'Level = floor(XP ÷ 1000)',
      'XP: Bronze 50, Silver 100, Gold 200, Platinum (per 100% game) 500',
      'Gold/Silver/Bronze trophies: based on global Steam rarity (<20%, 20–40%, 40%+)',
      'Platinum count: games at 100% completion',
      'Monthly activity: unlocks grouped by month from save timestamps'
    ]
  },
  {
    id: 'add-game',
    title: 'Add Game wizard',
    paragraphs: [
      'For games not yet discovered: search → pick steam_api.dll → choose whether to also apply the Goldberg emulator → apply → Done → Refresh library.',
      'Always installs steam_settings and seeds achievements. Optionally backs up and replaces the Steam API DLL with the Goldberg regular build. Does not launch the game.',
      'Enable Play games from launcher on the Library toolbar to show Set install folder / Select exe / Play on game detail. The button is Set install folder (no path yet), Select exe (path but no exe), or Play (exe saved). Picking an executable only saves it — Play launches later. With a path, AchieveMe walks up from the steam DLL folder until a parent name matches the game title, then lists executables under that tree. Ambiguous folder names ask you to confirm. Use the chevron for Change executable.'
    ]
  },
  {
    id: 'tools',
    title: 'Tools (Steamless)',
    paragraphs: [
      'Tools sits between Library and Settings. Link a Steamless release folder in Settings → External tools (must include Steamless.CLI.exe and Plugins).',
      'Open the Steamless wizard to pick a library game (uses launch_exe when set, otherwise resolves executables from install_path) or Search for executable on disk, then run Steamless.CLI. Output is typically Game.exe.unpacked.exe beside the original; Play is not changed automatically.'
    ]
  },
  {
    id: 'backup',
    title: 'Backup & restore',
    paragraphs: [
      'Export includes library metadata and Goldberg/GSE {appid} folders plus emulator settings folders.',
      'Export does not include CODEX or RUNE files.',
      'Import merges file-by-file and does not delete other games. Custom watch paths must exist on the target machine.'
    ]
  },
  {
    id: 'delete',
    title: 'Removing games',
    paragraphs: [
      'Long-press → Delete removes the library entry and deletes Goldberg/GSE save folders from disk.',
      'If you delete save files externally and Refresh, the game disappears from the library but no extra disk delete runs.',
      'Disabling a source and Refreshing removes games only found via that source.'
    ]
  },
  {
    id: 'merge',
    title: 'Multiple sources for one game',
    paragraphs: [
      'If the same App ID has saves in several emulators, AchieveMe merges them: earned if any source says earned; unlock time is the latest timestamp.',
      'Merge priority (low to high): RUNE → CODEX → GSE → Goldberg.'
    ]
  },
  {
    id: 'faq',
    title: 'FAQ',
    paragraphs: [],
    bullets: [
      'Missing icons/names? Add API key and Refresh.',
      'Empty achievement list? Need a Steam API key; or Steam has not published schema yet (try Refresh later); or the game has no achievements.',
      'Live updates? Save file edits propagate in ~1s via the file watcher.',
      'Keyboard: Enter/Space on a focused card opens it; Escape closes the long-press menu.',
      'Privacy: data stays local (SQLite + userData). API key in settings.json. Hidden descriptions may fetch from SteamDB.'
    ]
  }
]

export function getSourceHelp(source: SourceId): EmulatorSourceHelp | undefined {
  return EMULATOR_SOURCES.find((s) => s.id === source)
}
