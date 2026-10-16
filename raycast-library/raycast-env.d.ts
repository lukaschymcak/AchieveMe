/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** AchieveMe Database Path - Path to achieveme.db. Leave blank to auto-detect from %APPDATA%\achieveme\achieveme.db */
  "dbPath"?: string,
  /** AchieveMe.exe - Path to AchieveMe.exe. Leave blank to use the installed app in Local AppData. */
  "achievemeExe"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-library` command */
  export type SearchLibrary = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-library` command */
  export type SearchLibrary = {}
}

