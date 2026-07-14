import React from 'react'

export type ChipVariant = 'default' | 'nav' | 'action' | 'danger'

function chipClassName(
  variant: ChipVariant,
  active: boolean,
  className: string
): string {
  const parts = ['app-chip', 'library-chip']

  if (variant === 'nav') {
    parts.push('app-chip--nav', 'library-chip--nav')
  }
  if (variant === 'action') {
    parts.push('app-chip--action', 'library-chip--action')
  }
  if (variant === 'danger') {
    parts.push('app-chip--danger', 'library-chip--danger')
  }
  if (active) {
    parts.push('app-chip--active', 'library-chip--active')
    if (variant === 'danger') {
      parts.push('app-chip--danger-active', 'library-chip--danger-active')
    }
  }
  if (className) {
    parts.push(className)
  }

  return parts.join(' ')
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant
  active?: boolean
}

export default function Chip({
  variant = 'default',
  active = false,
  className = '',
  type = 'button',
  ...props
}: Props): React.ReactElement {
  return (
    <button
      type={type}
      className={chipClassName(variant, active, className)}
      {...props}
    />
  )
}
