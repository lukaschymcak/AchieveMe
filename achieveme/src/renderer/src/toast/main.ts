import './toast.css'
import type { ToastTier, UnlockToastPayload } from '../../../shared/types'
import {
  formatToastXp,
  toastEyebrow,
  toastXpForTier
} from '../../../shared/unlockToastUtils'

declare global {
  interface Window {
    toastApi: {
      ready: () => void
      onShow: (cb: (payload: UnlockToastPayload) => void) => void
      done: () => void
      click: (appid: string) => void
    }
  }
}

const ICON_HOLD_MS = 750
const PULSE_AT_MS = 60
const EXPAND_MS = 700
const SHRINK_MS = 700
const TEXT_OUT_MS = 320
const VISIBLE_MS = 4800
const EXIT_MS = 280
const XP_COUNT_MS = 600

const TEXT_FADE_SELECTOR =
  '.unlock-toast__eyebrow, .unlock-toast__name, .unlock-toast__game, .unlock-toast__points'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Toast root missing')
}
const root: HTMLElement = rootEl

let hideTimer: ReturnType<typeof setTimeout> | null = null
let exitTimer: ReturnType<typeof setTimeout> | null = null
let expandTimer: ReturnType<typeof setTimeout> | null = null
let pulseTimer: ReturnType<typeof setTimeout> | null = null
let xpRaf: number | null = null
let currentAppid = ''

function clearTimers(): void {
  if (hideTimer) clearTimeout(hideTimer)
  if (exitTimer) clearTimeout(exitTimer)
  if (expandTimer) clearTimeout(expandTimer)
  if (pulseTimer) clearTimeout(pulseTimer)
  if (xpRaf !== null) cancelAnimationFrame(xpRaf)
  hideTimer = null
  exitTimer = null
  expandTimer = null
  pulseTimer = null
  xpRaf = null
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function animateXpCount(el: HTMLElement, target: number, durationMs: number): void {
  if (prefersReducedMotion() || target <= 0) {
    el.textContent = `+${target}`
    return
  }

  const start = performance.now()
  el.textContent = '+0'

  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / durationMs)
    el.textContent = `+${Math.round(target * easeOutCubic(t))}`
    if (t < 1) {
      xpRaf = requestAnimationFrame(tick)
    } else {
      xpRaf = null
      el.textContent = `+${target}`
    }
  }

  xpRaf = requestAnimationFrame(tick)
}

function finish(): void {
  clearTimers()
  root.innerHTML = ''
  window.toastApi.done()
}

function fadeOutTextAndXp(card: HTMLElement, onDone: () => void): void {
  const targets = card.querySelectorAll<HTMLElement>(TEXT_FADE_SELECTOR)

  // Kill enter animations and lock opacity at fully visible, then transition to 0.
  // (Removing CSS animations otherwise snaps opacity back to the base "0" rule.)
  for (const el of targets) {
    el.style.animation = 'none'
    el.style.opacity = '1'
    el.style.transition = 'none'
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const el of targets) {
        el.style.transition = `opacity ${TEXT_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
        el.style.opacity = '0'
      }
      expandTimer = setTimeout(onDone, TEXT_OUT_MS)
    })
  })
}

function scheduleDismiss(card: HTMLElement): void {
  hideTimer = setTimeout(() => {
    if (prefersReducedMotion()) {
      card.classList.remove('unlock-toast--visible')
      card.classList.add('unlock-toast--exit')
      exitTimer = setTimeout(finish, EXIT_MS)
      return
    }

    fadeOutTextAndXp(card, () => {
      card.classList.remove('unlock-toast--expanded')
      expandTimer = setTimeout(() => {
        card.classList.remove('unlock-toast--visible')
        card.classList.add('unlock-toast--exit')
        exitTimer = setTimeout(finish, EXIT_MS)
      }, SHRINK_MS)
    })
  }, VISIBLE_MS)
}

function startExpandSequence(card: HTMLElement, pointsEl: HTMLElement, tier: ToastTier): void {
  requestAnimationFrame(() => {
    card.classList.add('unlock-toast--visible')

    if (prefersReducedMotion()) {
      card.classList.add('unlock-toast--expanded')
      card.classList.add('unlock-toast--xp')
      pointsEl.textContent = formatToastXp(tier)
      scheduleDismiss(card)
      return
    }

    requestAnimationFrame(() => {
      pulseTimer = setTimeout(() => {
        card.classList.add('unlock-toast--pulse')
        card.classList.add('unlock-toast--shimmer')
      }, PULSE_AT_MS)

      expandTimer = setTimeout(() => {
        card.classList.remove('unlock-toast--pulse')
        card.classList.remove('unlock-toast--shimmer')
        card.classList.add('unlock-toast--expanded')

        expandTimer = setTimeout(() => {
          card.classList.add('unlock-toast--xp')
          animateXpCount(pointsEl, toastXpForTier(tier), XP_COUNT_MS)
          scheduleDismiss(card)
        }, EXPAND_MS)
      }, ICON_HOLD_MS)
    })
  })
}

function renderToast(payload: UnlockToastPayload): void {
  clearTimers()
  currentAppid = payload.appid
  const tier: ToastTier = payload.tier || 'bronze'
  const isPlatinum = tier === 'platinum'

  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'unlock-toast unlock-toast--icon'
  card.dataset.tier = tier
  card.setAttribute(
    'aria-label',
    isPlatinum ? 'Platinum unlocked' : 'Achievement unlocked'
  )

  const points = document.createElement('span')
  points.className = 'unlock-toast__points'
  points.textContent = '+0'
  points.setAttribute('aria-hidden', 'true')

  const iconWrap = document.createElement('span')
  iconWrap.className = 'unlock-toast__icon-wrap'

  if (payload.iconUrl) {
    const img = document.createElement('img')
    img.className = 'unlock-toast__icon'
    img.src = payload.iconUrl
    img.alt = ''
    img.width = 57
    img.height = 57
    img.onerror = () => {
      const fallback = document.createElement('span')
      fallback.className = 'unlock-toast__icon-fallback'
      fallback.setAttribute('aria-hidden', 'true')
      img.replaceWith(fallback)
    }
    iconWrap.appendChild(img)
  } else {
    const fallback = document.createElement('span')
    fallback.className = 'unlock-toast__icon-fallback'
    fallback.setAttribute('aria-hidden', 'true')
    iconWrap.appendChild(fallback)
  }

  const body = document.createElement('span')
  body.className = 'unlock-toast__body'

  const eyebrow = document.createElement('span')
  eyebrow.className = 'unlock-toast__eyebrow'
  eyebrow.textContent = toastEyebrow(tier)

  const nameEl = document.createElement('span')
  nameEl.className = 'unlock-toast__name'
  nameEl.textContent = payload.displayName

  body.append(eyebrow, nameEl)

  const gameName = payload.gameName?.trim() ?? ''
  if (gameName) {
    const gameEl = document.createElement('span')
    gameEl.className = 'unlock-toast__game'
    gameEl.textContent = gameName
    body.appendChild(gameEl)
  }

  card.append(points, iconWrap, body)
  root.replaceChildren(card)

  card.addEventListener('click', () => {
    window.toastApi.click(currentAppid)
    finish()
  })

  startExpandSequence(card, points, tier)
}

window.toastApi.onShow(renderToast)
window.toastApi.ready()
