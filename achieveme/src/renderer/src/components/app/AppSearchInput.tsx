import React from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string
}

export default function AppSearchInput({
  className = '',
  ...props
}: Props): React.ReactElement {
  return (
    <input
      className={`app-chrome__search library-chrome__search ${className}`.trim()}
      {...props}
    />
  )
}
