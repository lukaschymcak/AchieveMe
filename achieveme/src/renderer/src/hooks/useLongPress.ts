import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { computeHoldDurationMs } from './longPressUtils'

interface Options {
  onLongPress: () => void
  onShortPress: () => void
  threshold?: number
  gracePeriod?: number
  moveThreshold?: number
  disabled?: boolean
}

export function useLongPress({
  onLongPress,
  onShortPress,
  threshold = 500,
  gracePeriod = 120,
  moveThreshold = 10,
  disabled = false
}: Options): {
  isHolding: boolean
  holdDurationMs: number
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerLeave: (e: PointerEvent) => void
  onPointerCancel: (e: PointerEvent) => void
} {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const longPressedRef = useRef(false)
  const [isHolding, setIsHolding] = useState(false)
  const holdDurationMs = computeHoldDurationMs(threshold, gracePeriod)

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current)
      graceTimerRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    clearLongPressTimer()
    clearGraceTimer()
  }, [clearGraceTimer, clearLongPressTimer])

  const endPress = useCallback(() => {
    clearTimers()
    setIsHolding(false)
    startRef.current = null
  }, [clearTimers])

  const cancelHold = useCallback(() => {
    endPress()
    longPressedRef.current = false
  }, [endPress])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.button !== 0) return
      longPressedRef.current = false
      startRef.current = { x: e.clientX, y: e.clientY }
      clearTimers()

      graceTimerRef.current = setTimeout(() => {
        if (startRef.current) {
          setIsHolding(true)
        }
        graceTimerRef.current = null
      }, gracePeriod)

      longPressTimerRef.current = setTimeout(() => {
        longPressedRef.current = true
        onLongPress()
        longPressTimerRef.current = null
      }, threshold)
    },
    [clearTimers, disabled, gracePeriod, onLongPress, threshold]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!startRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      if (Math.hypot(dx, dy) > moveThreshold) {
        cancelHold()
      }
    },
    [cancelHold, moveThreshold]
  )

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.button !== 0) return
      const wasLongPress = longPressedRef.current
      const hadActivePress = startRef.current !== null
      endPress()
      if (!wasLongPress && hadActivePress) {
        onShortPress()
      }
      longPressedRef.current = false
    },
    [disabled, endPress, onShortPress]
  )

  const onPointerLeave = useCallback(() => {
    cancelHold()
  }, [cancelHold])

  const onPointerCancel = onPointerLeave

  return {
    isHolding,
    holdDurationMs,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel
  }
}
