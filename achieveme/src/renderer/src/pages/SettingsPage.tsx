import React from 'react'
import SteamApiKeyForm from '../components/SteamApiKeyForm'

export default function SettingsPage(): React.ReactElement {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Settings</h2>
      <SteamApiKeyForm />
      <p style={{ marginTop: 24, fontSize: 13, color: '#666' }}>
        More settings (emulator sources, custom folders) coming in a future update.
      </p>
    </div>
  )
}
