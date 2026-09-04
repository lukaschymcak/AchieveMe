import React from 'react'
import type { TransferDockRow } from '../../../shared/transfersDockUtils'

interface Props {
  rows: TransferDockRow[]
  expanded: boolean
  onToggle: () => void
  onOpenRow: (row: TransferDockRow) => void
}

/**
 * App-shell Transfers dock: compact chip + expandable list of active transfers.
 */
export default function TransfersDock({
  rows,
  expanded,
  onToggle,
  onOpenRow
}: Props): React.ReactElement | null {
  if (rows.length === 0) return null

  const primary = rows[0]
  const countLabel = rows.length === 1 ? '1 transfer' : `${rows.length} transfers`

  return (
    <div className="transfers-dock" role="region" aria-label="Transfers">
      <button
        type="button"
        className="transfers-dock__chip"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="transfers-dock-panel"
        aria-label={expanded ? 'Hide transfers panel' : `Show transfers: ${countLabel}`}
      >
        <span className="transfers-dock__chip-meta">
          <span className="transfers-dock__chip-title">{countLabel}</span>
          <span className="transfers-dock__bar" aria-hidden="true">
            <span
              className="transfers-dock__fill"
              style={{ width: `${Math.round(primary.pct)}%` }}
            />
          </span>
          <span className="transfers-dock__chip-sub">
            {primary.title} — {Math.round(primary.pct)}%
          </span>
        </span>
      </button>

      {expanded && (
        <div id="transfers-dock-panel" className="transfers-dock__panel">
          <ul className="transfers-dock__list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="transfers-dock__row"
                  onClick={() => onOpenRow(row)}
                  aria-label={`Open ${row.title}`}
                >
                  <span className="transfers-dock__row-title">{row.title}</span>
                  <span className="transfers-dock__row-status">{row.statusLabel}</span>
                  <span className="transfers-dock__bar" aria-hidden="true">
                    <span
                      className="transfers-dock__fill"
                      style={{ width: `${Math.round(row.pct)}%` }}
                    />
                  </span>
                  <span className="transfers-dock__row-pct">{Math.round(row.pct)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
