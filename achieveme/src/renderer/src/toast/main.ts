import './toast.css'
import type { ToastTier, UnlockToastPayload } from '../../../shared/types'
import { formatToastXp, toastEyebrow } from '../../../shared/unlockToastUtils'

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

/** How long the icon-only square stays on screen before expanding. */
const ICON_HOLD_MS = 500
const EXPAND_MS = 450
/** Slower than expand so the right edge eases in cleanly. */
const SHRINK_MS = 650
const VISIBLE_MS = 4000
const EXIT_MS = 240

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Toast root missing')
}
const root: HTMLElement = rootEl

let hideTimer: ReturnType<typeof setTimeout> | null = null
let exitTimer: ReturnType<typeof setTimeout> | null = null
let expandTimer: ReturnType<typeof setTimeout> | null = null
let currentAppid = ''

function clearTimers(): void {
  if (hideTimer) clearTimeout(hideTimer)
  if (exitTimer) clearTimeout(exitTimer)
  if (expandTimer) clearTimeout(expandTimer)
  hideTimer = null
  exitTimer = null
  expandTimer = null
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function finish(): void {
  clearTimers()
  root.innerHTML = ''
  window.toastApi.done()
}

function scheduleDismiss(card: HTMLElement): void {
  hideTimer = setTimeout(() => {
    if (prefersReducedMotion()) {
      card.classList.remove('unlock-toast--visible')
      card.classList.add('unlock-toast--exit')
      exitTimer = setTimeout(finish, EXIT_MS)
      return
    }

    // Reverse of expand: shrink from the right (icon stays left), then fade out.
    card.classList.remove('unlock-toast--expanded')
    expandTimer = setTimeout(() => {
      card.classList.remove('unlock-toast--visible')
      card.classList.add('unlock-toast--exit')
      exitTimer = setTimeout(finish, EXIT_MS)
    }, SHRINK_MS)
  }, VISIBLE_MS)
}

function startExpandSequence(card: HTMLElement): void {
  // Paint collapsed icon first, then hold, then expand.
  requestAnimationFrame(() => {
    card.classList.add('unlock-toast--visible')

    if (prefersReducedMotion()) {
      card.classList.add('unlock-toast--expanded')
      scheduleDismiss(card)
      return
    }

    requestAnimationFrame(() => {
      expandTimer = setTimeout(() => {
        card.classList.add('unlock-toast--expanded')
        expandTimer = setTimeout(() => {
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
  points.textContent = formatToastXp(tier)
  points.setAttribute('aria-hidden', 'true')

  const iconWrap = document.createElement('span')
  iconWrap.className = 'unlock-toast__icon-wrap'

  if (payload.iconUrl) {
    const img = document.createElement('img')
    img.className = 'unlock-toast__icon'
    img.src = payload.iconUrl
    img.alt = ''
    img.width = 48
    img.height = 48
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

  startExpandSequence(card)
}

window.toastApi.onShow(renderToast)
window.toastApi.ready()
