import React, { useEffect, useState } from 'react'
import type { ActiveDepotSession, AppSettings } from '../../../shared/types'
import { AppChrome, AppNav, AppShell, Chip } from '../components/app'
import SteamlessWizard from '../components/SteamlessWizard'
import type { AppPage } from '../lib/appNavigation'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
  onOpenDepotWizard: () => void
  depotSession: ActiveDepotSession | null
}

export default function ToolsPage({
  page,
  onNavigate,
  onOpenDepotWizard,
  depotSession
}: Props): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [steamlessOpen, setSteamlessOpen] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  const steamlessFolder = settings?.steamlessFolder?.trim() ?? ''
  const steamlessLinked = steamlessFolder.length > 0
  const hubcapKey = settings?.hubcapApiKey?.trim() ?? ''
  const hubcapLinked = hubcapKey.length > 0
  const depotActive =
    depotSession != null &&
    (depotSession.phase === 'fetching' ||
      depotSession.phase === 'depots' ||
      depotSession.phase === 'downloading')

  return (
    <AppShell column>
      <AppChrome left={<AppNav page={page} onNavigate={onNavigate} />} />

      <div className="tools-page">
        <header className="tools-page__header">
          <h1 className="tools-page__title">External tools</h1>
          <p className="tools-page__lead">
            Link third-party utilities in Settings, then run them here. AchieveMe does not bundle
            Steamless. DepotDownloader ships with the app when packaged.
          </p>
        </header>

        <div className="tools-page__grid">
          <article className="tools-card">
            <h2 className="tools-card__title">Steamless</h2>
            <p className="tools-card__body">
              Unpack SteamStub DRM from a game executable using a linked Steamless.CLI install.
            </p>
            {steamlessLinked ? (
              <p className="tools-card__path" title={steamlessFolder}>
                Linked: {steamlessFolder}
              </p>
            ) : (
              <p className="tools-card__hint">
                Set the Steamless folder in Settings → External tools first.
              </p>
            )}
            <div className="tools-card__actions">
              <Chip
                variant="action"
                disabled={!steamlessLinked}
                onClick={() => {
                  if (!steamlessLinked) return
                  setSteamlessOpen(true)
                }}
              >
                Open wizard
              </Chip>
              {!steamlessLinked && (
                <Chip onClick={() => onNavigate('settings')}>Open Settings</Chip>
              )}
            </div>
          </article>

          <article className="tools-card">
            <h2 className="tools-card__title">Depot Downloader</h2>
            <p className="tools-card__body">
              Search Steam games, fetch a Hubcap manifest, pick depots, and download with
              DepotDownloader. Optionally set up Goldberg achievements afterward.
            </p>
            {hubcapLinked ? (
              <p className="tools-card__path">Hubcap API key configured</p>
            ) : (
              <p className="tools-card__hint">
                Optional Hubcap API key can be set in Settings → Depot Downloader.
              </p>
            )}
            {depotActive && (
              <p className="tools-card__path">
                Download in progress — reopen the wizard from the badge or below.
              </p>
            )}
            <div className="tools-card__actions">
              <Chip variant="action" onClick={onOpenDepotWizard}>
                {depotActive ? 'Reopen wizard' : 'Open wizard'}
              </Chip>
              <Chip onClick={() => onNavigate('settings')}>Open Settings</Chip>
            </div>
          </article>
        </div>
      </div>

      {steamlessOpen && (
        <SteamlessWizard
          onClose={() => {
            setSteamlessOpen(false)
            window.api.getSettings().then(setSettings)
          }}
        />
      )}
    </AppShell>
  )
}
