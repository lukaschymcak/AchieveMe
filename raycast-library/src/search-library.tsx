/**
 * AchieveMe Library — Search Library command
 *
 * Reads directly from the local AchieveMe SQLite database via better-sqlite3.
 * No network, no IPC — just a local DB read.
 */

import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

import { loadGames } from "./libraryDb.js";
import { launchGame } from "./launchGame.js";
import {
  type LibraryGame,
  buildDetailMarkdown,
  formatAchievements,
  formatCompletion,
  formatLastUnlock,
  formatPlaytime,
  matchesSearch,
  steamStoreUrl,
} from "./libraryModel.js";

// ── Main command ─────────────────────────────────────────────────────────────

export default function SearchLibrary() {
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error } = useCachedPromise(loadGames, [], {
    keepPreviousData: true,
  });

  // Client-side filter — library is at most a few hundred games, instant
  const games = (data ?? []).filter((g) => matchesSearch(g, searchText));

  // ── Error: DB not found or SQLite error ────────────────────────────────────
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Cannot open AchieveMe library"
          description={message}
          actions={
            <ActionPanel>
              <Action
                title="Set Custom Database Path"
                icon={Icon.Gear}
                onAction={openExtensionPreferences}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  // ── Empty library ──────────────────────────────────────────────────────────
  if (!isLoading && games.length === 0 && !searchText) {
    return (
      <List isLoading={false}>
        <List.EmptyView
          icon={Icon.GameController}
          title="No games in your library"
          description="Open AchieveMe and add some games first."
        />
      </List>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search your library…"
      onSearchTextChange={setSearchText}
      throttle
    >
      {games.map((game) => (
        <GameListItem key={game.appid} game={game} />
      ))}
    </List>
  );
}

// ── List item ─────────────────────────────────────────────────────────────────

function GameListItem({ game }: { game: LibraryGame }) {
  const achievementText = formatAchievements(game);
  const lastUnlock = formatLastUnlock(game.last_unlocked_at);

  return (
    <List.Item
      key={game.appid}
      title={game.name}
      icon={{ source: game.cover_source, fallback: Icon.GameController }}
      accessories={
        achievementText
          ? [
              {
                text: achievementText,
                icon: game.has_platinum
                  ? { source: Icon.Trophy, tintColor: Color.Purple }
                  : Icon.Star,
                tooltip: `Achievements: ${achievementText}`,
              },
            ]
          : undefined
      }
      detail={<GameDetail game={game} lastUnlock={lastUnlock} />}
      actions={<GameActions game={game} />}
    />
  );
}

// ── Detail side panel ─────────────────────────────────────────────────────────

function GameDetail({ game, lastUnlock }: { game: LibraryGame; lastUnlock: string | null }) {
  const achievementText = formatAchievements(game);
  const completionText = formatCompletion(game);
  const playtimeText = formatPlaytime(game.playtime_seconds);

  const trophyIcon =
    game.has_platinum
      ? { source: Icon.Trophy, tintColor: Color.Purple }
      : game.completion_pct >= 75
      ? { source: Icon.Trophy, tintColor: Color.Yellow }
      : game.completion_pct >= 40
      ? { source: Icon.Trophy, tintColor: Color.SecondaryText }
      : { source: Icon.Trophy, tintColor: Color.Orange };

  return (
    <List.Item.Detail
      markdown={buildDetailMarkdown(game)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Game" text={game.name} />
          <List.Item.Detail.Metadata.Separator />

          {achievementText && (
            <>
              <List.Item.Detail.Metadata.Label
                title="Achievements"
                text={achievementText}
                icon={Icon.Star}
              />
              <List.Item.Detail.Metadata.Label
                title="Completion"
                text={completionText}
                icon={trophyIcon}
              />
              {lastUnlock && (
                <List.Item.Detail.Metadata.Label
                  title="Last Achievement"
                  text={lastUnlock.replace("Last unlock: ", "")}
                  icon={Icon.Calendar}
                />
              )}
            </>
          )}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Playtime"
            text={playtimeText}
            icon={Icon.Clock}
          />

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="App ID" text={game.appid} />

          {game.launch_exe && (
            <List.Item.Detail.Metadata.Label
              title="Launch Exe"
              text={game.launch_exe.split(/[\\/]/).pop() ?? game.launch_exe}
              icon={Icon.Play}
            />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

// ── Actions ────────────────────────────────────────────────────────────────────

function GameActions({ game }: { game: LibraryGame }) {
  return (
    <ActionPanel>
      <ActionPanel.Section>
        {game.launch_exe ? (
          <Action
            title="Launch Game"
            icon={Icon.Play}
            onAction={() => launchGame(game)}
          />
        ) : (
          <Action.OpenInBrowser
            title="Open in Steam Store"
            url={steamStoreUrl(game.appid)}
            icon={Icon.Globe}
          />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section>
        <Action.OpenInBrowser
          title="View on Steam Store"
          url={steamStoreUrl(game.appid)}
          icon={Icon.Globe}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
        />
        <Action.CopyToClipboard
          title="Copy App ID"
          content={game.appid}
          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
        />
        <Action.CopyToClipboard
          title="Copy Game Name"
          content={game.name}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
