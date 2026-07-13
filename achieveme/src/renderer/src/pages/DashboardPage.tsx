import React, { useEffect, useState } from 'react'
import type { ProfileStats } from '../../../shared/types'

export default function DashboardPage(): React.ReactElement {
  const [stats, setStats] = useState<ProfileStats | null>(null)

  useEffect(() => {
    window.api.getProfileStats().then(setStats)
  }, [])

  useEffect(() => {
    function handleLibraryUpdated(): void {
      window.api.getProfileStats().then(setStats)
    }

    window.api.onLibraryUpdated(handleLibraryUpdated)

    return () => {
      window.api.offLibraryUpdated(handleLibraryUpdated)
    }
  }, [])

  if (!stats) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  const maxCount = Math.max(...stats.monthlyActivity.map((m) => m.count), 1)

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Profile</h2>

      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatBox label="Games" value={stats.totalGames} />
        <StatBox label="Unlocked" value={stats.totalUnlocked} />
        <StatBox label="Level" value={stats.level} />
        <StatBox label="XP" value={stats.xp} />
        <StatBox label="Platinum" value={stats.platinum} color="#7b68ee" />
        <StatBox label="Gold" value={stats.gold} color="#f5c518" />
        <StatBox label="Silver" value={stats.silver} color="#a8a8a8" />
        <StatBox label="Bronze" value={stats.bronze} color="#cd7f32" />
      </div>

      <h3 style={{ marginBottom: 12 }}>Monthly Activity</h3>
      {stats.monthlyActivity.length === 0 ? (
        <p style={{ color: '#888' }}>No unlocks yet.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {stats.monthlyActivity.map((m) => (
            <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: `${Math.round((m.count / maxCount) * 100)}px`,
                  background: '#5865f2',
                  borderRadius: 3,
                  minHeight: 4
                }}
                title={`${m.month}: ${m.count}`}
              />
              <span style={{ fontSize: 10, color: '#888', writingMode: 'vertical-rl' }}>
                {m.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
  color
}: {
  label: string
  value: number
  color?: string
}): React.ReactElement {
  return (
    <div
      style={{
        background: '#1a1a22',
        border: `1px solid ${color ?? '#3a3a48'}`,
        borderRadius: 8,
        padding: '12px 20px',
        minWidth: 80,
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? '#e8e8e8' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  )
}
