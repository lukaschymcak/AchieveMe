import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const POPOVER_MAX_WIDTH = 280
const VIEWPORT_PAD = 12

interface Props {
  content: string
  label?: string
  className?: string
}

function clampPopoverLeft(triggerCenterX: number, popoverWidth: number): number {
  const half = popoverWidth / 2
  let left = triggerCenterX - half
  left = Math.max(VIEWPORT_PAD, left)
  left = Math.min(left, window.innerWidth - popoverWidth - VIEWPORT_PAD)
  return left
}

export default function HelpTip({
  content,
  label = 'More info',
  className = ''
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tipId = useId()

  function updatePopoverPosition(): void {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const popoverWidth = Math.min(
      POPOVER_MAX_WIDTH,
      window.innerWidth - VIEWPORT_PAD * 2
    )
    const left = clampPopoverLeft(rect.left + rect.width / 2, popoverWidth)
    const top = rect.bottom + 6

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width: popoverWidth,
      maxWidth: `calc(100vw - ${VIEWPORT_PAD * 2}px)`
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePopoverPosition()
  }, [open, content])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: PointerEvent): void {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      const popover = document.getElementById(tipId)
      if (popover?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }

    function handleReposition(): void {
      updatePopoverPosition()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, tipId])

  const popover =
    open &&
    createPortal(
      <span
        id={tipId}
        role="tooltip"
        className="help-tip__popover help-tip__popover--floating"
        style={popoverStyle}
      >
        {content}
      </span>,
      document.body
    )

  return (
    <span className={`help-tip ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`help-tip__trigger${open ? ' help-tip__trigger--open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {popover}
    </span>
  )
}
