/**
 * Asks the AchieveMe app to launch the game.
 * AchieveMe.exe --launch-appid <id> runs the same Play path as the in-app button.
 */

import { spawn } from "child_process";
import fs from "fs";
import { closeMainWindow, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { achievemeExeCandidates, devAppDirs, resolveAchieveMeLaunch, type AchieveMeLaunchTarget } from "./achievemeExe.js";
import type { LibraryGame } from "./libraryModel.js";

interface Preferences {
  achievemeExe?: string;
}

function findAchieveMeLaunch(appid: string): AchieveMeLaunchTarget | null {
  let custom = "";
  try {
    custom = getPreferenceValues<Preferences>().achievemeExe ?? "";
  } catch {
    custom = "";
  }
  return resolveAchieveMeLaunch(
    custom,
    devAppDirs(),
    achievemeExeCandidates(),
    (filePath) => fs.existsSync(filePath),
    appid
  );
}

/**
 * Start AchieveMe with the game's AppID, then close Raycast.
 */
export async function launchGame(game: LibraryGame): Promise<void> {
  const target = findAchieveMeLaunch(game.appid);
  if (!target) {
    await showToast({
      style: Toast.Style.Failure,
      title: "AchieveMe.exe not found",
      message: "Install AchieveMe, or set its path in extension preferences.",
    });
    return;
  }

  try {
    const child = spawn(target.exe, target.args, {
      cwd: target.cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    await closeMainWindow();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to launch game",
      message,
    });
  }
}

export { steamStoreUrl } from "./libraryModel.js";
