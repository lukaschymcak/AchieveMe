import React from 'react'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export default function AppToolbarButton({
  children,
  type = 'button',
  className = '',
  ...props
}: Props): React.ReactElement {
  return (
    <button
      type={type}
      className={`app-toolbar-btn library-view-toggle ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
