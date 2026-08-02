import React, { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { AppChrome, AppNav, AppShell, Chip } from '../components/app'
import SteamlessWizard from '../components/SteamlessWizard'
import type { AppPage } from '../lib/appNavigation'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
}

export default function ToolsPage({ page, onNavigate }: Props): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  const steamlessFolder = settings?.steamlessFolder?.trim() ?? ''
  const linked = steamlessFolder.length > 0

  return (
    <AppShell column>
      <AppChrome left={<AppNav page={page} onNavigate={onNavigate} />} />

      <div className="tools-page">
        <header className="tools-page__header">
          <h1 className="tools-page__title">External tools</h1>
          <p className="tools-page__lead">
            Link third-party utilities in Settings, then run them here. AchieveMe does not bundle
            these programs.
          </p>
        </header>

        <div className="tools-page__grid">
          <article className="tools-card">
            <h2 className="tools-card__title">Steamless</h2>
            <p className="tools-card__body">
              Unpack SteamStub DRM from a game executable using a linked Steamless.CLI install.
            </p>
            {linked ? (
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
                disabled={!linked}
                onClick={() => {
                  if (!linked) return
                  setWizardOpen(true)
                }}
              >
                Open wizard
              </Chip>
              {!linked && (
                <Chip onClick={() => onNavigate('settings')}>Open Settings</Chip>
              )}
            </div>
          </article>
        </div>
      </div>

      {wizardOpen && (
        <SteamlessWizard
          onClose={() => {
            setWizardOpen(false)
            window.api.getSettings().then(setSettings)
          }}
        />
      )}
    </AppShell>
  )
}
