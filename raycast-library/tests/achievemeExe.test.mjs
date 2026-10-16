import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAchieveMeExe, resolveAchieveMeLaunch } from "../src/achievemeExe.ts";

describe("resolveAchieveMeExe", () => {
  it("uses a custom path when that file exists", () => {
    assert.equal(
      resolveAchieveMeExe("D:\\Apps\\AchieveMe.exe", ["C:\\nope.exe"], (filePath) => filePath.startsWith("D:")),
      "D:\\Apps\\AchieveMe.exe"
    );
  });

  it("falls through to the first installed candidate", () => {
    assert.equal(
      resolveAchieveMeExe("", ["C:\\missing.exe", "C:\\AchieveMe\\AchieveMe.exe"], (filePath) =>
        filePath.includes("AchieveMe\\AchieveMe")
      ),
      "C:\\AchieveMe\\AchieveMe.exe"
    );
  });

  it("returns null when nothing exists", () => {
    assert.equal(resolveAchieveMeExe("D:\\gone.exe", ["C:\\gone.exe"], () => false), null);
  });
});

describe("resolveAchieveMeLaunch", () => {
  it("starts the repo electron with the app folder when that build exists", () => {
    const target = resolveAchieveMeLaunch(
      "",
      ["C:\\repo\\achieveme"],
      ["C:\\Users\\Luka\\AppData\\Local\\Programs\\AchieveMe\\AchieveMe.exe"],
      (filePath) => filePath.includes("repo") || filePath.endsWith("index.js"),
      "2054970"
    );
    assert.equal(target?.exe, "C:\\repo\\achieveme\\node_modules\\electron\\dist\\electron.exe");
    assert.deepEqual(target?.args, ["C:\\repo\\achieveme", "--launch-appid", "2054970"]);
    assert.equal(target?.cwd, "C:\\repo\\achieveme");
  });

  it("falls back to the installed exe", () => {
    const target = resolveAchieveMeLaunch("", ["C:\\missing"], ["C:\\Programs\\AchieveMe\\AchieveMe.exe"], (filePath) =>
      filePath.endsWith("AchieveMe.exe"),
    "1086940");
    assert.deepEqual(target?.args, ["--launch-appid", "1086940"]);
  });
});
