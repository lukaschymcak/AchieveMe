import React, { useEffect, useState } from 'react'
import type { GameDetail } from '../../../shared/types'
import {
  achievementDescription,
  achievementIconSrc,
  isHiddenAchievement
} from '../lib/achievementDisplay'

interface Props {
  appid: string
  onBack: () => void
}

const TIER_COLOR: Record<string, string> = {
  gold: '#f5c518',
  silver: '#a8a8a8',
  bronze: '#cd7f32'
}

export default function GameDetailPage({ appid, onBack }: Props): React.ReactElement {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => {
    window.api.getGameDetail(appid).then(setDetail)
  }, [appid])

  if (!detail) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  const { game, achievements } = detail
  const hiddenCount = achievements.filter((a) => isHiddenAchievement(a.hidden) && !a.earned).length

  const visibleAchievements = achievements.filter((ach) => {
    if (!isHiddenAchievement(ach.hidden) || ach.earned) return true
    return showHidden
  })

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'flex-start' }}>
        {detail.cover_url && (
          <img
            src={detail.cover_url}
            alt={game.name}
            style={{
              width: 280,
              maxWidth: '100%',
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              borderRadius: 6,
              flexShrink: 0,
              background: '#2a2a35'
            }}
          />
        )}
        <div>
          <h2 style={{ marginBottom: 8 }}>{game.name}</h2>
          <p style={{ color: '#888', fontSize: 13 }}>
            {game.unlocked_achievements} / {game.total_achievements} achievements (
            {Math.round(game.completion_pct)}%)
          </p>
          {game.has_platinum === 1 && (
            <p style={{ color: '#7b68ee', fontSize: 13, marginTop: 4 }}>✦ Platinum</p>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 12
        }}
      >
        <h3>Achievements</h3>
        {hiddenCount > 0 && (
          <button onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleAchievements.map((ach) => {
          const desc = achievementDescription(ach.description, ach.hidden ?? 0, ach.earned, showHidden)
          const isHidden = isHiddenAchievement(ach.hidden)

          return (
            <div
              key={ach.api_name}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                background: '#1a1a22',
                border: `1px solid ${ach.earned ? TIER_COLOR[ach.trophy_tier] : '#2a2a35'}`,
                borderRadius: 8,
                padding: '10px 14px',
                opacity: ach.earned ? 1 : isHidden ? 0.65 : 0.5
              }}
            >
              <img
                src={achievementIconSrc(game.appid, ach.earned, ach.icon_url, ach.icon_gray_url)}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0, background: '#2a2a35' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {ach.display_name}
                  {isHidden && <span style={{ marginLeft: 6, fontSize: 10, color: '#666' }}>hidden</span>}
                </div>
                {desc && (
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        desc.includes('Steam does not') || desc === 'Hidden achievement' ? '#666' : '#888',
                      fontStyle: desc === 'Hidden achievement' ? 'italic' : 'normal',
                      marginTop: 2
                    }}
                  >
                    {desc}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: TIER_COLOR[ach.trophy_tier],
                    textTransform: 'capitalize'
                  }}
                >
                  {ach.trophy_tier}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {ach.global_percent > 0 ? `${ach.global_percent.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
