import React, { useEffect, useState } from 'react'
import type { AppSettings, SourceId } from '../../../shared/types'
import { ALL_SOURCES } from '../../../shared/types'
import { AppChrome, AppNav, AppSearchInput, AppShell, Chip } from '../components/app'
import HelpTip from '../components/HelpTip'
import type { AppPage } from '../lib/appNavigation'
import {
  EMULATOR_SOURCES,
  SETTINGS_HINTS,
  TOOLTIPS,
  getSourceHelp
} from '../lib/helpContent'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
}

export default function SettingsPage({ page, onNavigate }: Props): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveHint, setSaveHint] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [newFolder, setNewFolder] = useState('')
  const [showSourcesTable, setShowSourcesTable] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  function setApiKey(key: string): void {
    setSettings((s) => s && { ...s, steamApiKey: key })
  }

  function toggleSource(source: SourceId, checked: boolean): void {
    setSettings((s) => {
      if (!s) return s
      const enabled = checked
        ? [...s.enabledSources, source]
        : s.enabledSources.filter((x) => x !== source)
      return { ...s, enabledSources: enabled }
    })
  }

  function addFolder(): void {
    const val = newFolder.trim()
    if (!val) return
    setSettings((s) => {
      if (!s) return s
      if (s.customWatchFolders.includes(val)) return s
      return { ...s, customWatchFolders: [...s.customWatchFolders, val] }
    })
    setNewFolder('')
  }

  function removeFolder(index: number): void {
    setSettings((s) => {
      if (!s) return s
      return { ...s, customWatchFolders: s.customWatchFolders.filter((_, i) => i !== index) }
    })
  }

  function toggleSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setSettings((s) => s && { ...s, [key]: value })
  }

  function testNotification(): void {
    void window.api.previewUnlockToast()
  }

  function testSessionRecap(): void {
    void window.api.previewSessionRecap()
  }

  function browseSoundPath(): void {
    window.api.browseSoundPath().then((picked) => {
      if (!picked) return
      setSettings((s) => s && { ...s, customSoundPath: picked })
    })
  }

  function save(): void {
    if (!settings) return
    window.api.saveSettings(settings).then(() => {
      setSaved(true)
      setSaveHint(true)
      setTimeout(() => setSaved(false), 2000)
      setTimeout(() => setSaveHint(false), 6000)
    })
  }

  function importZip(): void {
    if (!window.confirm(SETTINGS_HINTS.importConfirm)) return
    window.api.importZip().then((result) => {
      if (!result) return
      const errNote = result.errors.length > 0 ? ` (${result.errors.length} warnings)` : ''
      setImportMsg(
        `Imported ${result.gamesImported} games, wrote ${result.filesWritten} files${errNote}. Open Library and click Refresh if the list looks stale.`
      )
      setTimeout(() => setImportMsg(null), 6000)
    })
  }

  if (!settings) {
    return (
      <AppShell centered>
        <p className="settings-page__loading">Loading settings…</p>
      </AppShell>
    )
  }

  return (
    <AppShell column>
      <AppChrome
        left={<AppNav page={page} onNavigate={onNavigate} />}
        right={
          <>
            {saved && (
              <span
                className="settings-page__status settings-page__status--success settings-page__chrome-status"
                role="status"
              >
                Saved!
              </span>
            )}
            {saveHint && !saved && (
              <span
                className="settings-page__status settings-page__status--muted settings-page__chrome-status"
                role="status"
              >
                {SETTINGS_HINTS.saveSuccess}
              </span>
            )}
            {importMsg && (
              <span
                className="settings-page__status settings-page__status--success settings-page__chrome-status"
                role="status"
              >
                {importMsg}
              </span>
            )}
            <Chip variant="action" onClick={save}>
              Save Settings
            </Chip>
          </>
        }
      />

      <div className="settings-page">
        <section className="settings-page__section" aria-labelledby="settings-api-key">
          <h2 id="settings-api-key" className="settings-page__section-title">
            Steam API Key
            <HelpTip content={TOOLTIPS.settingsApiKey} label="Steam API key help" />
          </h2>
          <p className="settings-page__lead">
            {SETTINGS_HINTS.apiKey}{' '}
            Get one at{' '}
            <a
              href="https://steamcommunity.com/dev/apikey"
              target="_blank"
              rel="noreferrer"
              className="settings-page__external-link"
            >
              steamcommunity.com/dev/apikey
            </a>
          </p>
          <p className="settings-page__note">{SETTINGS_HINTS.apiKeySettingsNote}</p>
          <AppSearchInput
            type="text"
            value={settings.steamApiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your Steam Web API key"
            autoComplete="off"
            spellCheck={false}
          />
        </section>

        <section className="settings-page__section" aria-labelledby="settings-sources">
          <h2 id="settings-sources" className="settings-page__section-title">
            Emulator Sources
            <HelpTip content={TOOLTIPS.settingsSources} label="Emulator sources help" />
          </h2>
          <div className="settings-page__panel settings-page__sources-grid">
            {ALL_SOURCES.map((source) => {
              const enabled = settings.enabledSources.includes(source)
              const meta = getSourceHelp(source)
              return (
                <label key={source} className="settings-page__source-label">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggleSource(source, e.target.checked)}
                    className="settings-page__checkbox"
                  />
                  <span className="settings-page__source-name">
                    {source}
                    {meta?.notes && (
                      <span className="settings-source-note">{meta.notes}</span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
          <button
            type="button"
            className="settings-page__disclosure-link"
            aria-expanded={showSourcesTable}
            onClick={() => setShowSourcesTable((v) => !v)}
          >
            {showSourcesTable ? 'Hide default paths' : 'Show default paths and save files'}
          </button>
          {showSourcesTable && (
            <table className="settings-sources-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Default path</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {EMULATOR_SOURCES.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.defaultPath}</td>
                    <td>
                      <code>{row.fileName}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="settings-page__section" aria-labelledby="settings-notifications">
          <h2 id="settings-notifications" className="settings-page__section-title">
            Notifications
            <HelpTip content={TOOLTIPS.settingsNotifications} label="Notifications help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.notifications}</p>
          <div className="settings-page__panel settings-page__sources-grid">
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => toggleSetting('notificationsEnabled', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Show unlock toasts while playing</span>
            </label>
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => toggleSetting('soundEnabled', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Play sound on unlock</span>
            </label>
            <label
              className={`settings-page__source-label settings-page__volume-label${settings.soundEnabled ? '' : ' settings-page__source-label--disabled'}`}
            >
              <span className="settings-page__source-name">
                Unlock sound volume ({settings.soundVolume}%)
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={settings.soundVolume}
                disabled={!settings.soundEnabled}
                onChange={(e) => toggleSetting('soundVolume', Number(e.target.value))}
                className="settings-page__volume-slider"
                aria-label="Unlock sound volume"
              />
            </label>
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.sessionRecapEnabled}
                onChange={(e) => toggleSetting('sessionRecapEnabled', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Show session recap after play</span>
            </label>
          </div>
          <div className="settings-page__folder-add settings-page__folder-add--sound">
            <AppSearchInput
              type="text"
              value={settings.customSoundPath}
              onChange={(e) => toggleSetting('customSoundPath', e.target.value)}
              placeholder="Custom unlock sound (.wav or .mp3)"
              className="settings-page__input--nested"
              spellCheck={false}
              disabled={!settings.soundEnabled}
            />
            <Chip onClick={browseSoundPath} disabled={!settings.soundEnabled}>
              Browse
            </Chip>
          </div>
          <p className="settings-page__note">{SETTINGS_HINTS.customSound}</p>
          <p className="settings-page__note">{SETTINGS_HINTS.soundVolume}</p>
          <div className="settings-page__action-row">
            <Chip variant="action" onClick={testNotification}>
              Test notification
            </Chip>
            <Chip variant="action" onClick={testSessionRecap}>
              Test session recap
            </Chip>
          </div>
          <p className="settings-page__note">{SETTINGS_HINTS.testNotification}</p>
          <p className="settings-page__note">{SETTINGS_HINTS.testSessionRecap}</p>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-tray">
          <h2 id="settings-tray" className="settings-page__section-title">
            Tray &amp; startup
            <HelpTip content={TOOLTIPS.settingsTray} label="Tray and startup help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.tray}</p>
          <div className="settings-page__panel settings-page__sources-grid">
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.closeToTray}
                onChange={(e) => toggleSetting('closeToTray', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Close to system tray (keep watching saves)</span>
            </label>
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.openAtLogin}
                onChange={(e) => toggleSetting('openAtLogin', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Launch AchieveMe when Windows starts</span>
            </label>
            <label
              className={`settings-page__source-label${settings.openAtLogin ? '' : ' settings-page__source-label--disabled'}`}
            >
              <input
                type="checkbox"
                checked={settings.startMinimizedToTray}
                disabled={!settings.openAtLogin}
                onChange={(e) => toggleSetting('startMinimizedToTray', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Start minimized to tray on login</span>
            </label>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-play-sessions">
          <h2 id="settings-play-sessions" className="settings-page__section-title">
            Play sessions
            <HelpTip content={TOOLTIPS.settingsPlaySessions} label="Play sessions help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.playSessions}</p>
          <div className="settings-page__panel settings-page__sources-grid">
            <label className="settings-page__source-label">
              <input
                type="checkbox"
                checked={settings.playtimeTrackingEnabled}
                onChange={(e) => toggleSetting('playtimeTrackingEnabled', e.target.checked)}
                className="settings-page__checkbox"
              />
              <span className="settings-page__source-name">Track playtime for games added via Add Game</span>
            </label>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-folders">
          <h2 id="settings-folders" className="settings-page__section-title">
            Custom Watch Folders
            <HelpTip content={TOOLTIPS.settingsCustomFolders} label="Custom watch folders help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.customFolders}</p>
          <div className="settings-page__panel">
            {settings.customWatchFolders.length > 0 && (
              <ul className="settings-page__folder-list">
                {settings.customWatchFolders.map((folder, i) => (
                  <li key={folder} className="settings-page__folder-row">
                    <span className="settings-page__folder-path" title={folder}>
                      {folder}
                    </span>
                    <button
                      type="button"
                      className="settings-page__icon-btn settings-page__icon-btn--remove"
                      onClick={() => removeFolder(i)}
                      aria-label={`Remove folder ${folder}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="settings-page__folder-add">
              <AppSearchInput
                type="text"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addFolder()
                }}
                placeholder="C:\path\to\folder"
                className="settings-page__input--nested"
                spellCheck={false}
              />
              <Chip onClick={addFolder}>Add</Chip>
            </div>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-external-tools">
          <h2 id="settings-external-tools" className="settings-page__section-title">
            External tools
            <HelpTip content={TOOLTIPS.settingsSteamless} label="External tools help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.steamlessFolder}</p>
          <div className="settings-page__folder-add settings-page__folder-add--sound">
            <AppSearchInput
              type="text"
              value={settings.steamlessFolder}
              onChange={(e) => toggleSetting('steamlessFolder', e.target.value)}
              placeholder="Path to Steamless folder"
              className="settings-page__input--nested"
              spellCheck={false}
            />
            <Chip
              onClick={() => {
                void window.api
                  .browseSteamlessFolder()
                  .then((picked) => {
                    if (!picked) return
                    setSettings((s) => s && { ...s, steamlessFolder: picked })
                  })
                  .catch((err: unknown) => {
                    window.alert(err instanceof Error ? err.message : String(err))
                  })
              }}
            >
              Browse
            </Chip>
            {settings.steamlessFolder.trim() !== '' && (
              <Chip
                onClick={() => toggleSetting('steamlessFolder', '')}
              >
                Clear
              </Chip>
            )}
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-depot">
          <h2 id="settings-depot" className="settings-page__section-title">
            Depot Downloader
            <HelpTip content={TOOLTIPS.settingsDepotDownloader} label="Depot Downloader help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.hubcapApiKey}</p>
          <div className="settings-page__folder-add settings-page__folder-add--sound">
            <AppSearchInput
              type="password"
              value={settings.hubcapApiKey}
              onChange={(e) => toggleSetting('hubcapApiKey', e.target.value)}
              placeholder="Hubcap API key"
              className="settings-page__input--nested"
              spellCheck={false}
              autoComplete="off"
            />
            {settings.hubcapApiKey.trim() !== '' && (
              <Chip onClick={() => toggleSetting('hubcapApiKey', '')}>Clear</Chip>
            )}
          </div>
          <p className="settings-page__lead" style={{ marginTop: 16 }}>
            {SETTINGS_HINTS.depotDownloadPath}
          </p>
          <div className="settings-page__folder-add settings-page__folder-add--sound">
            <AppSearchInput
              type="text"
              value={settings.depotDownloadPath}
              onChange={(e) => toggleSetting('depotDownloadPath', e.target.value)}
              placeholder="Default download folder"
              className="settings-page__input--nested"
              spellCheck={false}
            />
            <Chip
              onClick={() => {
                void window.api.depotBrowseOutputFolder().then((picked) => {
                  if (!picked) return
                  setSettings((s) => s && { ...s, depotDownloadPath: picked })
                })
              }}
            >
              Browse
            </Chip>
            {settings.depotDownloadPath.trim() !== '' && (
              <Chip onClick={() => toggleSetting('depotDownloadPath', '')}>Clear</Chip>
            )}
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-backup">
          <h2 id="settings-backup" className="settings-page__section-title">
            Backup &amp; Restore
            <HelpTip content={TOOLTIPS.settingsBackup} label="Backup and restore help" />
          </h2>
          <p className="settings-page__lead">{SETTINGS_HINTS.backup}</p>
          <div className="settings-page__action-row">
            <Chip variant="action" onClick={() => window.api.exportZip()}>
              Export
            </Chip>
            <Chip variant="action" onClick={importZip}>
              Import
            </Chip>
          </div>
        </section>

        <p className="settings-page__footer-note">
          All data is stored locally. Your API key is saved in settings.json under AchieveMe user
          data. Hidden achievement descriptions may be fetched from SteamDB.
        </p>
      </div>
    </AppShell>
  )
}
