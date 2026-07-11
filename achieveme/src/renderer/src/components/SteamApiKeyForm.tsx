import React, { useEffect, useState } from 'react'

interface Props {
  prominent?: boolean
  onSaved?: () => void
}

export default function SteamApiKeyForm({
  prominent = false,
  onSaved
}: Props): React.ReactElement {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((s) => setValue(s.steamApiKey))
  }, [])

  async function handleSave(): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Please enter a Steam Web API key.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const settings = await window.api.getSettings()
      await window.api.saveSettings({ ...settings, steamApiKey: trimmed })
      await window.api.refresh()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key.')
    } finally {
      setSaving(false)
    }
  }

  const wrapperStyle: React.CSSProperties = prominent
    ? {
        maxWidth: 520,
        margin: '48px auto',
        padding: 32,
        background: '#1a1a22',
        border: '2px solid #f5c518',
        borderRadius: 12,
        textAlign: 'center'
      }
    : {
        maxWidth: 480,
        padding: 24,
        background: '#1a1a22',
        border: '1px solid #3a3a48',
        borderRadius: 8
      }

  return (
    <div style={wrapperStyle}>
      {prominent && (
        <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
          <h2 style={{ marginBottom: 8, color: '#f5c518' }}>Steam API key required</h2>
          <p style={{ fontSize: 14, color: '#aaa', marginBottom: 24, lineHeight: 1.5 }}>
            AchieveMe needs a Steam Web API key to load achievement names, descriptions, and icons.
            Your library will stay hidden until one is set.
          </p>
        </>
      )}

      {!prominent && <h3 style={{ marginBottom: 8 }}>Steam API key</h3>}

      <label style={{ display: 'block', textAlign: 'left', marginBottom: 8, fontSize: 13, color: '#888' }}>
        API key
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste your Steam Web API key"
        style={{
          width: '100%',
          padding: '10px 12px',
          background: '#0f0f13',
          border: '1px solid #3a3a48',
          borderRadius: 6,
          color: '#e8e8e8',
          fontSize: 14,
          marginBottom: 12
        }}
      />

      <p style={{ fontSize: 12, color: '#666', textAlign: 'left', marginBottom: 16, lineHeight: 1.5 }}>
        Get a free key at steamcommunity.com/dev/apikey
      </p>

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={handleSave} disabled={saving} style={{ width: prominent ? '100%' : undefined }}>
        {saving ? 'Saving...' : 'Save & refresh library'}
      </button>
    </div>
  )
}
