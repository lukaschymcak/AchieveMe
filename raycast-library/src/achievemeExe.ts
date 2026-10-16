import os from "os";
import path from "path";

/** How to start AchieveMe so it receives `--launch-appid`. */
export interface AchieveMeLaunchTarget {
  exe: string;
  args: string[];
  cwd: string;
}

/**
 * Repo checkouts whose compiled main process understands `--launch-appid`.
 * The installed exe is a separate build and does not, until it is reinstalled.
 */
export function devAppDirs(): string[] {
  return [
    path.join(os.homedir(), "Documents", "Github", "AchieveMe", "achieveme"),
    path.resolve(process.cwd(), "..", "achieveme"),
  ];
}

export function electronExeForApp(appDir: string): string {
  return path.join(appDir, "node_modules", "electron", "dist", "electron.exe");
}

/**
 * Installed AchieveMe.exe locations, most likely first.
 * electron-builder per-user NSIS uses `%LOCALAPPDATA%\Programs\AchieveMe\AchieveMe.exe`.
 */
export function achievemeExeCandidates(): string[] {
  const candidates: string[] = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    candidates.push(path.join(local, "Programs", "AchieveMe", "AchieveMe.exe"));
    candidates.push(path.join(local, "Programs", "achieveme", "AchieveMe.exe"));
  }
  candidates.push(path.join(os.homedir(), "AppData", "Local", "Programs", "AchieveMe", "AchieveMe.exe"));
  return [...new Set(candidates)];
}

/**
 * Custom preference wins when that file exists. Otherwise the first candidate that exists.
 */
export function resolveAchieveMeExe(
  customPath: string | undefined,
  candidates: readonly string[],
  exists: (filePath: string) => boolean
): string | null {
  const custom = customPath?.trim() ?? "";
  if (custom && exists(custom)) return custom;
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

/**
 * Dev electron is preferred: it is the process that holds the library lock while
 * `electron.exe .` is running, and it loads `out/main`, which has the launch flag.
 */
export function resolveAchieveMeLaunch(
  customPath: string | undefined,
  devAppDirs: readonly string[],
  installedExes: readonly string[],
  exists: (filePath: string) => boolean,
  appid: string
): AchieveMeLaunchTarget | null {
  const custom = customPath?.trim() ?? "";
  if (custom && exists(custom)) return commandForExe(custom, appid);

  for (const appDir of devAppDirs) {
    const exe = electronExeForApp(appDir);
    const main = path.join(appDir, "out", "main", "index.js");
    if (exists(exe) && exists(main)) {
      return { exe, args: [appDir, "--launch-appid", appid], cwd: appDir };
    }
  }

  for (const exe of installedExes) {
    if (exists(exe)) return commandForExe(exe, appid);
  }
  return null;
}

function commandForExe(exe: string, appid: string): AchieveMeLaunchTarget {
  if (path.basename(exe).toLowerCase() === "electron.exe") {
    const appDir = path.resolve(path.dirname(exe), "..", "..", "..", "..");
    return { exe, args: [appDir, "--launch-appid", appid], cwd: appDir };
  }
  return { exe, args: ["--launch-appid", appid], cwd: path.dirname(exe) };
}
