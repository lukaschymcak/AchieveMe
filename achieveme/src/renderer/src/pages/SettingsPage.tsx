import React, { useEffect, useState } from 'react'
import type { AppSettings, SourceId } from '../../../shared/types'
import { ALL_SOURCES } from '../../../shared/types'

export default function SettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [newFolder, setNewFolder] = useState('')

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  if (!settings) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

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

  function save(): void {
    if (!settings) return
    window.api.saveSettings(settings).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function importJson(): void {
    window.api.importJson().then((result) => {
      if (!result) return
      const errNote = result.errors.length > 0 ? ` (${result.errors.length} warnings)` : ''
      setImportMsg(
        `Imported ${result.gamesImported} games, wrote ${result.saveFilesWritten} save files${errNote}`
      )
      setTimeout(() => setImportMsg(null), 4000)
    })
  }

  function importZip(): void {
    window.api.importZip().then((result) => {
      if (!result) return
      const errNote = result.errors.length > 0 ? ` (${result.errors.length} warnings)` : ''
      setImportMsg(
        `Imported ${result.gamesImported} games, wrote ${result.filesWritten} files${errNote}`
      )
      setTimeout(() => setImportMsg(null), 4000)
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h2 style={{ marginBottom: 24 }}>Settings</h2>

      {/* Steam API Key */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 8 }}>Steam API Key</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
          Required to fetch achievement names, icons, and global percentages.
          Get one at{' '}
          <a
            href="https://steamcommunity.com/dev/apikey"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#5865f2' }}
          >
            steamcommunity.com/dev/apikey
          </a>
        </p>
        <input
          type="text"
          value={settings.steamApiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Your Steam Web API key"
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#1a1a22',
            border: '1px solid #3a3a48',
            borderRadius: 6,
            color: '#e8e8e8',
            fontSize: 13
          }}
        />
      </section>

      {/* Enabled Sources */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Emulator Sources</h3>
        <div
          style={{
            background: '#1a1a22',
            border: '1px solid #2a2a35',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8
          }}
        >
          {ALL_SOURCES.map((source) => {
            const enabled = settings.enabledSources.includes(source)
            return (
              <label
                key={source}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleSource(source, e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>{source}</span>
              </label>
            )
          })}
        </div>
      </section>

      {/* Custom watch folders */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 8 }}>Custom Watch Folders</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Extra folders to monitor for achievement saves. Each enabled emulator source is scanned
          in these folders in addition to its default locations.
        </p>
        <div
          style={{
            background: '#1a1a22',
            border: '1px solid #2a2a35',
            borderRadius: 8,
            padding: '12px 14px'
          }}
        >
          {settings.customWatchFolders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {settings.customWatchFolders.map((folder, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#888',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {folder}
                  </span>
                  <button
                    onClick={() => removeFolder(i)}
                    style={{ padding: '2px 8px', fontSize: 11, color: '#f87171', borderColor: '#f87171' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFolder()
              }}
              placeholder="C:\path\to\folder"
              style={{
                flex: 1,
                padding: '4px 8px',
                background: '#0f0f13',
                border: '1px solid #3a3a48',
                borderRadius: 4,
                color: '#e8e8e8',
                fontSize: 12
              }}
            />
            <button onClick={addFolder} style={{ fontSize: 12, padding: '4px 10px' }}>
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Backup */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 8 }}>Backup &amp; Restore</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Export JSON for lightweight achievement progress only. Full Backup zips entire Goldberg/GSE
          appid folders plus the global emulator <code>settings</code> folder (including extra save
          files). Import merges file-by-file and does not delete other games on disk.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => window.api.exportJson()}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Export JSON
          </button>
          <button
            onClick={() => window.api.exportZip()}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Export Full Backup
          </button>
          <button onClick={importJson} style={{ padding: '8px 16px', fontSize: 13 }}>
            Import JSON
          </button>
          <button onClick={importZip} style={{ padding: '8px 16px', fontSize: 13 }}>
            Import Full Backup
          </button>
        </div>
      </section>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={save}
          style={{
            padding: '8px 24px',
            background: '#5865f2',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontWeight: 600,
            fontSize: 13
          }}
        >
          Save Settings
        </button>
        {saved && <span style={{ fontSize: 13, color: '#4ade80' }}>Saved!</span>}
        {importMsg && <span style={{ fontSize: 13, color: '#4ade80' }}>{importMsg}</span>}
      </div>
    </div>
  )
}
