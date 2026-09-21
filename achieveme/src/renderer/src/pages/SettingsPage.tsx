import React from 'react'
import type { AppSettings, SourceId, AppUpdateState } from '../../../shared/types'
import { ALL_SOURCES } from '../../../shared/types'
import { DEFAULT_GAMES_ROOT_CANDIDATES } from '../../../shared/installedGamesScanUtils'
import { formatUpdateStatusLabel } from '../../../shared/autoUpdateUtils'
import {
  SETTINGS_GROUPS,
  SETTINGS_COPY,
  SETTINGS_CHIP_LABELS,
  formatSourceLabel,
  settingsGroupTooltipKey,
  settingsNoticeFromError,
  settingsRowClassName
} from '../../../shared/settingsPageUtils'
import { STEAM_WEB_API_KEY_URL } from '../../../shared/steamUrls'
import { AppChrome, AppNav, AppSearchInput, AppShell, Chip } from '../components/app'
import HelpTip from '../components/HelpTip'
import type { AppPage } from '../lib/appNavigation'
import { TOOLTIPS } from '../lib/helpContent'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
}

const CLOUD_OVERWRITE_CONFIRM = `${SETTINGS_COPY.cloudConfirmLead}\n\n${SETTINGS_COPY.cloudConfirmBody}`

type ChromeNotice = { kind: 'ok' | 'error'; text: string }

function SettingsChromeStatus({ notice }: { notice: ChromeNotice | null }): React.ReactElement | null {
  if (!notice) return null
  return (
    <span
      className={`settings-page__status settings-page__chrome-status${
        notice.kind === 'error'
          ? ' settings-page__status--error'
          : ' settings-page__status--success'
      }`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.text}
    </span>
  )
}

export default function SettingsPage({ page, onNavigate }: Props): React.ReactElement {
  const [settings, setSettings] = React.useState<AppSettings | null>(null)
  const [loginItemsSupported, setLoginItemsSupported] = React.useState(true)
  const [saveNotice, setSaveNotice] = React.useState<ChromeNotice | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [backingUp, setBackingUp] = React.useState(false)
  const saveNoticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = React.useRef(true)
  const [newFolder, setNewFolder] = React.useState('')
  const [newScanRoot, setNewScanRoot] = React.useState('')
  const [cloudStatus, setCloudStatus] = React.useState<{
    configured: boolean
    apiUrlHost: string | null
  } | null>(null)
  const [cloudBusy, setCloudBusy] = React.useState(false)
  const [cloudMessage, setCloudMessage] = React.useState('')
  const [updateState, setUpdateState] = React.useState<AppUpdateState | null>(null)
  const [checkingUpdates, setCheckingUpdates] = React.useState(false)

  const refreshCloudStatus = (): void => {
    void window.api
      .ludusaviCloudStatus()
      .then(setCloudStatus)
      .catch(() => setCloudStatus(null))
  }

  React.useEffect(() => {
    if (!window.api?.getUpdateState) return
    void window.api.getUpdateState().then(setUpdateState)
    const handleUpdate = (state: AppUpdateState) => {
      setUpdateState(state)
    }
    window.api.onUpdateStateChanged(handleUpdate)
    return () => {
      window.api?.offUpdateStateChanged?.(handleUpdate)
    }
  }, [])

  const handleCheckForUpdates = async (): Promise<void> => {
    if (!window.api?.checkForUpdates) return
    setCheckingUpdates(true)
    try {
      const res = await window.api.checkForUpdates()
      setUpdateState(res)
    } finally {
      setCheckingUpdates(false)
    }
  }

  const showSaveNotice = (kind: 'ok' | 'error', text: string): void => {
    if (saveNoticeTimer.current) {
      clearTimeout(saveNoticeTimer.current)
      saveNoticeTimer.current = null
    }
    setSaveNotice({ kind, text })
    if (kind === 'ok') {
      saveNoticeTimer.current = setTimeout(() => {
        setSaveNotice(null)
        saveNoticeTimer.current = null
      }, 2000)
    }
  }

  const handleLoadSettings = (): void => {
    void (async () => {
      setLoading(true)
      try {
        const [nextSettings, runtime] = await Promise.all([
          window.api.getSettings(),
          window.api.getAppRuntime()
        ])
        if (!mountedRef.current) return
        if (saveNoticeTimer.current) {
          clearTimeout(saveNoticeTimer.current)
          saveNoticeTimer.current = null
        }
        setSaveNotice(null)
        setSettings(nextSettings)
        setLoginItemsSupported(runtime.loginItemsSupported)
        setLoadFailed(false)
      } catch (err) {
        if (!mountedRef.current) return
        setLoadFailed(true)
        showSaveNotice('error', settingsNoticeFromError(err, SETTINGS_COPY.loadFailed))
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    })()
  }

  React.useEffect(() => {
    mountedRef.current = true
    handleLoadSettings()
    refreshCloudStatus()
    return () => {
      mountedRef.current = false
      if (saveNoticeTimer.current) clearTimeout(saveNoticeTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleSource = (source: SourceId, checked: boolean): void => {
    setSettings((s) => {
      if (!s) return s
      const enabled = checked
        ? [...s.enabledSources, source]
        : s.enabledSources.filter((x) => x !== source)
      return { ...s, enabledSources: enabled }
    })
  }

  const handleAddFolder = (): void => {
    const val = newFolder.trim()
    if (!val) return
    setSettings((s) => {
      if (!s) return s
      if (s.customWatchFolders.includes(val)) return s
      return { ...s, customWatchFolders: [...s.customWatchFolders, val] }
    })
    setNewFolder('')
  }

  const handleRemoveFolder = (index: number): void => {
    setSettings((s) => {
      if (!s) return s
      return { ...s, customWatchFolders: s.customWatchFolders.filter((_, i) => i !== index) }
    })
  }

  const handleAddScanRoot = (): void => {
    const val = newScanRoot.trim()
    if (!val) return
    setSettings((s) => {
      if (!s) return s
      if (s.installScanRoots.includes(val)) return s
      return { ...s, installScanRoots: [...s.installScanRoots, val] }
    })
    setNewScanRoot('')
  }

  const handleRemoveScanRoot = (index: number): void => {
    setSettings((s) => {
      if (!s) return s
      return { ...s, installScanRoots: s.installScanRoots.filter((_, i) => i !== index) }
    })
  }

  const handleAddSuggestedScanRoots = (): void => {
    setSettings((s) => {
      if (!s) return s
      const next = [...s.installScanRoots]
      for (const root of DEFAULT_GAMES_ROOT_CANDIDATES) {
        if (!next.includes(root)) next.push(root)
      }
      return { ...s, installScanRoots: next }
    })
  }

  const handleToggleSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void => {
    setSettings((s) => s && { ...s, [key]: value })
  }

  const handleBrowsePath = (
    picker: () => Promise<string | null>,
    key: 'customSoundPath' | 'ludusaviPath' | 'steamlessFolder' | 'depotDownloadPath'
  ): void => {
    void picker()
      .then((picked) => {
        if (!mountedRef.current || !picked) return
        setSettings((s) => s && { ...s, [key]: picked })
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return
        showSaveNotice('error', settingsNoticeFromError(err, SETTINGS_COPY.browseFailed))
      })
  }

  const persistSettings = async (): Promise<boolean> => {
    if (!settings || saving) return false
    setSaving(true)
    try {
      await window.api.saveSettings(settings)
      showSaveNotice('ok', SETTINGS_COPY.saved)
      return true
    } catch (err) {
      showSaveNotice('error', settingsNoticeFromError(err, SETTINGS_COPY.saveFailed))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = (): void => {
    void persistSettings()
  }

  const handleBackupLibrary = (): void => {
    if (!settings || backingUp) return
    if (!settings.ludusaviPath.trim()) {
      showSaveNotice('error', SETTINGS_COPY.setLudusaviThenSave)
      return
    }
    setBackingUp(true)
    void window.api
      .ludusaviBackupLibrary()
      .catch((err: unknown) => {
        if (!mountedRef.current) return
        showSaveNotice('error', settingsNoticeFromError(err, SETTINGS_COPY.backupFailed))
      })
      .finally(() => {
        if (mountedRef.current) setBackingUp(false)
      })
  }

  const handleCloudDownload = async (): Promise<void> => {
    if (!window.confirm(CLOUD_OVERWRITE_CONFIRM)) {
      return
    }
    setCloudBusy(true)
    setCloudMessage(SETTINGS_COPY.downloading)
    try {
      const ok = await persistSettings()
      if (!ok) {
        setCloudMessage(SETTINGS_COPY.saveFirstThenDownload)
        return
      }
      const result = await window.api.ludusaviCloudDownload()
      if (!result.ok) {
        setCloudMessage(result.error || SETTINGS_COPY.downloadFailed)
        return
      }
      setCloudMessage(result.error || SETTINGS_COPY.downloadedBackups)
      refreshCloudStatus()
    } catch (err) {
      setCloudMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setCloudBusy(false)
    }
  }

  if (!settings) {
    if (loadFailed) {
      return (
        <AppShell column>
          <AppChrome
            sticky
            left={<AppNav page={page} onNavigate={onNavigate} />}
            right={
              <>
                <SettingsChromeStatus notice={saveNotice} />
                <Chip
                  variant="action"
                  onClick={handleLoadSettings}
                  disabled={loading}
                  aria-busy={loading}
                >
                  {SETTINGS_COPY.retry}
                </Chip>
              </>
            }
          />
          <div className="settings-page">
            <h1 className="visually-hidden">{SETTINGS_COPY.pageTitle}</h1>
          </div>
        </AppShell>
      )
    }
    return (
      <AppShell centered>
        <h1 className="visually-hidden">{SETTINGS_COPY.pageTitle}</h1>
        <p className="settings-page__loading" role="status" aria-busy="true">
          {SETTINGS_COPY.loading}
        </p>
      </AppShell>
    )
  }

  const cloudStatusText = cloudStatus?.configured
    ? `${SETTINGS_COPY.ready}${cloudStatus.apiUrlHost ? ` (${cloudStatus.apiUrlHost})` : ''}`
    : SETTINGS_COPY.notSet
  const cloudControlText = cloudBusy
    ? SETTINGS_COPY.downloading
    : cloudMessage
      ? `${cloudStatusText}. ${cloudMessage}`
      : cloudStatusText

  return (
    <AppShell column>
      <AppChrome
        sticky
        left={<AppNav page={page} onNavigate={onNavigate} />}
        right={
          <>
            <SettingsChromeStatus notice={saveNotice} />
            <Chip
              variant="action"
              onClick={handleSave}
              disabled={saving}
              aria-busy={saving}
            >
              {SETTINGS_COPY.save}
            </Chip>
          </>
        }
      />

      <div className="settings-page">
        <h1 className="visually-hidden">{SETTINGS_COPY.pageTitle}</h1>
        <SettingsGroup id="library">
          <FieldRow label={SETTINGS_COPY.steamApiKey}>
            <AppSearchInput
              type="text"
              value={settings.steamApiKey}
              onChange={(e) => handleToggleSetting('steamApiKey', e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <a
              href={STEAM_WEB_API_KEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="settings-row__link"
              aria-label={SETTINGS_COPY.getKeyOpens}
            >
              {SETTINGS_COPY.getKey}
            </a>
          </FieldRow>
          {ALL_SOURCES.map((source) => (
            <ToggleRow
              key={source}
              label={formatSourceLabel(source)}
              checked={settings.enabledSources.includes(source)}
              onChange={(checked) => handleToggleSource(source, checked)}
            />
          ))}
          <FieldRow label={SETTINGS_COPY.saveFolders} clusterHead>
            <AppSearchInput
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFolder()
              }}
              placeholder="C:\path\to\folder"
              spellCheck={false}
            />
            <Chip onClick={handleAddFolder} aria-label={SETTINGS_CHIP_LABELS.addSaveFolder}>
              {SETTINGS_COPY.add}
            </Chip>
          </FieldRow>
          {settings.customWatchFolders.map((folder, i) => (
            <PathRow
              key={`watch-${folder}`}
              path={folder}
              onRemove={() => handleRemoveFolder(i)}
              removeLabel={`${SETTINGS_COPY.remove} ${folder}`}
            />
          ))}
          <FieldRow label={SETTINGS_COPY.installFolders} clusterHead>
            <AppSearchInput
              type="text"
              value={newScanRoot}
              onChange={(e) => setNewScanRoot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddScanRoot()
              }}
              placeholder="D:\Games"
              spellCheck={false}
            />
            <Chip onClick={handleAddScanRoot} aria-label={SETTINGS_CHIP_LABELS.addInstallFolder}>
              {SETTINGS_COPY.add}
            </Chip>
            <Chip onClick={handleAddSuggestedScanRoots}>{SETTINGS_COPY.addGamesFolders}</Chip>
          </FieldRow>
          {settings.installScanRoots.map((folder, i) => (
            <PathRow
              key={`scan-${folder}`}
              path={folder}
              onRemove={() => handleRemoveScanRoot(i)}
              removeLabel={`${SETTINGS_COPY.remove} ${folder}`}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup id="play">
          <ActionToggleRow
            label={SETTINGS_COPY.unlockToasts}
            checked={settings.notificationsEnabled}
            onChange={(checked) => handleToggleSetting('notificationsEnabled', checked)}
          >
            <Chip
              onClick={() => void window.api.previewUnlockToast()}
              aria-label={SETTINGS_CHIP_LABELS.previewUnlockToasts}
            >
              {SETTINGS_COPY.preview}
            </Chip>
          </ActionToggleRow>
          <ToggleRow
            label={SETTINGS_COPY.unlockSound}
            checked={settings.soundEnabled}
            onChange={(checked) => handleToggleSetting('soundEnabled', checked)}
          />
          <div
            className={`settings-row${settings.soundEnabled ? '' : ' settings-row--disabled'}`}
          >
            <span className="settings-row__label" id="settings-volume-label">
              {SETTINGS_COPY.volume}
            </span>
            <span className="settings-row__control">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={settings.soundVolume}
                disabled={!settings.soundEnabled}
                onChange={(e) => handleToggleSetting('soundVolume', Number(e.target.value))}
                className="settings-row__slider"
                aria-labelledby="settings-volume-label"
              />
              <span className="settings-row__value">{settings.soundVolume}%</span>
            </span>
          </div>
          <FieldRow label={SETTINGS_COPY.customSound} disabled={!settings.soundEnabled}>
            <AppSearchInput
              type="text"
              value={settings.customSoundPath}
              onChange={(e) => handleToggleSetting('customSoundPath', e.target.value)}
              placeholder=".wav or .mp3"
              spellCheck={false}
              disabled={!settings.soundEnabled}
            />
            <Chip
              onClick={() => handleBrowsePath(() => window.api.browseSoundPath(), 'customSoundPath')}
              disabled={!settings.soundEnabled}
              aria-label={SETTINGS_CHIP_LABELS.browseCustomSound}
            >
              {SETTINGS_COPY.browse}
            </Chip>
          </FieldRow>
          <ActionToggleRow
            label={SETTINGS_COPY.sessionRecap}
            checked={settings.sessionRecapEnabled}
            onChange={(checked) => handleToggleSetting('sessionRecapEnabled', checked)}
          >
            <Chip
              onClick={() => void window.api.previewSessionRecap()}
              aria-label={SETTINGS_CHIP_LABELS.previewSessionRecap}
            >
              {SETTINGS_COPY.preview}
            </Chip>
          </ActionToggleRow>
          <ToggleRow
            label={SETTINGS_COPY.closeToTray}
            checked={settings.closeToTray}
            onChange={(checked) => handleToggleSetting('closeToTray', checked)}
          />
          <ToggleRow
            label={SETTINGS_COPY.launchAtStartup}
            hint={!loginItemsSupported ? SETTINGS_COPY.startupSetupOnly : undefined}
            checked={settings.openAtLogin}
            disabled={!loginItemsSupported}
            onChange={(checked) => handleToggleSetting('openAtLogin', checked)}
          />
          <ToggleRow
            label={SETTINGS_COPY.startMinimized}
            checked={settings.startMinimizedToTray}
            disabled={!loginItemsSupported || !settings.openAtLogin}
            onChange={(checked) => handleToggleSetting('startMinimizedToTray', checked)}
          />
          <ToggleRow
            label={SETTINGS_COPY.hideOnGameStart}
            checked={settings.hideToTrayOnGameStart}
            onChange={(checked) => handleToggleSetting('hideToTrayOnGameStart', checked)}
          />
          <ToggleRow
            label={SETTINGS_COPY.trackPlaytime}
            checked={settings.playtimeTrackingEnabled}
            onChange={(checked) => handleToggleSetting('playtimeTrackingEnabled', checked)}
          />
        </SettingsGroup>

        <SettingsGroup id="backups">
          <FieldRow label={SETTINGS_COPY.ludusavi}>
            <AppSearchInput
              type="text"
              value={settings.ludusaviPath}
              onChange={(e) => handleToggleSetting('ludusaviPath', e.target.value)}
              placeholder="ludusavi.exe"
              spellCheck={false}
            />
            <Chip
              aria-label={SETTINGS_CHIP_LABELS.browseLudusavi}
              onClick={() => handleBrowsePath(() => window.api.browseLudusaviPath(), 'ludusaviPath')}
            >
              {SETTINGS_COPY.browse}
            </Chip>
            {settings.ludusaviPath.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('ludusaviPath', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearLudusavi}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.cloudUrl}>
            <AppSearchInput
              type="url"
              value={settings.cloudSavesApiUrl}
              onChange={(e) => handleToggleSetting('cloudSavesApiUrl', e.target.value)}
              placeholder="https://"
              spellCheck={false}
            />
            {settings.cloudSavesApiUrl.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('cloudSavesApiUrl', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearCloudUrl}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.cloudToken}>
            <AppSearchInput
              type="password"
              value={settings.cloudSavesApiToken}
              onChange={(e) => handleToggleSetting('cloudSavesApiToken', e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            {settings.cloudSavesApiToken.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('cloudSavesApiToken', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearCloudToken}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.cloud}>
            <span className="settings-row__status" role="status" aria-busy={cloudBusy}>
              {cloudControlText}
            </span>
            <Chip
              disabled={cloudBusy}
              aria-busy={cloudBusy}
              onClick={() => void handleCloudDownload()}
            >
              {cloudBusy ? SETTINGS_COPY.downloading : SETTINGS_COPY.downloadBackups}
            </Chip>
          </FieldRow>
          <ToggleRow
            label={SETTINGS_COPY.autoBackup}
            checked={settings.ludusaviAutoBackup}
            onChange={(checked) => handleToggleSetting('ludusaviAutoBackup', checked)}
          />
          <FieldRow label={SETTINGS_COPY.backupAllGames}>
            <Chip
              onClick={handleBackupLibrary}
              disabled={backingUp}
              aria-busy={backingUp}
            >
              {SETTINGS_COPY.backupNow}
            </Chip>
          </FieldRow>
        </SettingsGroup>

        <SettingsGroup id="tools">
          <FieldRow label={SETTINGS_COPY.steamless}>
            <AppSearchInput
              type="text"
              value={settings.steamlessFolder}
              onChange={(e) => handleToggleSetting('steamlessFolder', e.target.value)}
              spellCheck={false}
            />
            <Chip
              aria-label={SETTINGS_CHIP_LABELS.browseSteamless}
              onClick={() =>
                handleBrowsePath(() => window.api.browseSteamlessFolder(), 'steamlessFolder')
              }
            >
              {SETTINGS_COPY.browse}
            </Chip>
            {settings.steamlessFolder.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('steamlessFolder', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearSteamless}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.hubcapKey}>
            <AppSearchInput
              type="password"
              value={settings.hubcapApiKey}
              onChange={(e) => handleToggleSetting('hubcapApiKey', e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            {settings.hubcapApiKey.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('hubcapApiKey', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearHubcapKey}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.depotFolder}>
            <AppSearchInput
              type="text"
              value={settings.depotDownloadPath}
              onChange={(e) => handleToggleSetting('depotDownloadPath', e.target.value)}
              spellCheck={false}
            />
            <Chip
              aria-label={SETTINGS_CHIP_LABELS.browseDepotFolder}
              onClick={() =>
                handleBrowsePath(() => window.api.depotBrowseOutputFolder(), 'depotDownloadPath')
              }
            >
              {SETTINGS_COPY.browse}
            </Chip>
            {settings.depotDownloadPath.trim() !== '' && (
              <Chip
                onClick={() => handleToggleSetting('depotDownloadPath', '')}
                aria-label={SETTINGS_CHIP_LABELS.clearDepotFolder}
              >
                {SETTINGS_COPY.clear}
              </Chip>
            )}
          </FieldRow>
          <FieldRow label={SETTINGS_COPY.appVersion}>
            <span className="settings-row__status">
              {updateState?.currentVersion ? `v${updateState.currentVersion}` : ''}
              {updateState ? ` • ${formatUpdateStatusLabel(updateState)}` : ''}
            </span>
            {updateState?.status === 'downloaded' ? (
              <Chip
                aria-label={SETTINGS_CHIP_LABELS.installUpdate}
                onClick={() => void window.api.installUpdate()}
              >
                {SETTINGS_COPY.updateReady}
              </Chip>
            ) : (
              <Chip
                aria-label={SETTINGS_CHIP_LABELS.checkForUpdates}
                onClick={() => void handleCheckForUpdates()}
                disabled={
                  checkingUpdates ||
                  updateState?.status === 'checking' ||
                  updateState?.status === 'downloading'
                }
              >
                {checkingUpdates || updateState?.status === 'checking'
                  ? SETTINGS_COPY.checkingUpdates
                  : SETTINGS_COPY.checkForUpdates}
              </Chip>
            )}
          </FieldRow>
        </SettingsGroup>
      </div>
    </AppShell>
  )
}

function SettingsGroup({
  id,
  children
}: {
  id: (typeof SETTINGS_GROUPS)[number]['id']
  children: React.ReactNode
}): React.ReactElement {
  const group = SETTINGS_GROUPS.find((item) => item.id === id)
  const title = group?.title ?? id
  const headingId = `settings-${id}`
  return (
    <section className={`settings-page__group settings-page__group--${id}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="settings-page__group-title">
        {title}
        <HelpTip
          content={TOOLTIPS[settingsGroupTooltipKey(id)]}
          label={`${title} help`}
        />
      </h2>
      <div className="settings-page__list">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}): React.ReactElement {
  return (
    <label className={settingsRowClassName({ disabled })}>
      <span className="settings-row__label">
        {label}
        {hint ? <span className="settings-row__hint">{hint}</span> : null}
      </span>
      <span className="settings-row__control">
        <span className="settings-row__checkbox-wrap">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="settings-row__checkbox"
          />
        </span>
      </span>
    </label>
  )
}

function ActionToggleRow({
  label,
  checked,
  onChange,
  children
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}): React.ReactElement {
  const checkboxId = React.useId()
  return (
    <div className="settings-row">
      <label htmlFor={checkboxId} className="settings-row__label">
        {label}
      </label>
      <span className="settings-row__control">
        {children}
        <span className="settings-row__checkbox-wrap">
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="settings-row__checkbox"
          />
        </span>
      </span>
    </div>
  )
}

function FieldRow({
  label,
  disabled,
  clusterHead,
  children
}: {
  label: string
  disabled?: boolean
  clusterHead?: boolean
  children: React.ReactNode
}): React.ReactElement {
  const inputId = React.useId()
  let bound = false
  const nextChildren = React.Children.map(children, (child) => {
    if (bound || !React.isValidElement(child) || child.type !== AppSearchInput) {
      return child
    }
    bound = true
    return React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: inputId })
  })
  return (
    <div className={settingsRowClassName({ disabled, clusterHead })}>
      {bound ? (
        <label htmlFor={inputId} className="settings-row__label">
          {label}
        </label>
      ) : (
        <span className="settings-row__label">{label}</span>
      )}
      <span className="settings-row__control">{nextChildren}</span>
    </div>
  )
}

function PathRow({
  path,
  onRemove,
  removeLabel
}: {
  path: string
  onRemove: () => void
  removeLabel: string
}): React.ReactElement {
  return (
    <div className={settingsRowClassName({ path: true })}>
      <span className="settings-row__path" title={path}>
        {path}
      </span>
      <span className="settings-row__control">
        <Chip onClick={onRemove} aria-label={removeLabel}>
          {SETTINGS_COPY.remove}
        </Chip>
      </span>
    </div>
  )
}

