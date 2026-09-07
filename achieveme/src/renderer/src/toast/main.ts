import './toast.css'
import type { ToastTier, UnlockToastPayload } from '../../../shared/types'
import {
  formatToastXp,
  toastXpForTier
} from '../../../shared/unlockToastUtils'
import {
  clampToastPanelWidth,
  toastWindowWidthFromCard
} from '../../../shared/toastWidthUtils'

declare global {
  interface Window {
    toastApi: {
      ready: () => void
      onShow: (cb: (payload: UnlockToastPayload) => void) => void
      done: () => void
      click: (appid: string) => void
      resize: (width: number) => Promise<void>
    }
  }
}

/** Scale-in duration — icon hold starts after this settles. */
const SCALE_IN_MS = 350
/** Centered icon hold before expand. */
const ICON_HOLD_START_MS = 1000
/** Centered icon hold after shrink, before exit. */
const ICON_HOLD_END_MS = 500
const EXPAND_MS = 450
const SHRINK_MS = 450
const VISIBLE_MS = 4000
const EXIT_MS = 450
const XP_COUNT_MS = 600
const TEXT_OUT_MS = 280
/** Time from --play until expand (scale-in + settled icon hold). */
const PRE_EXPAND_MS = SCALE_IN_MS + ICON_HOLD_START_MS

const TEXT_FADE_SELECTOR =
  '.unlock-toast__name, .unlock-toast__description, .unlock-toast__points, .unlock-toast__body'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Toast root missing')
}
const root: HTMLElement = rootEl

let hideTimer: ReturnType<typeof setTimeout> | null = null
let exitTimer: ReturnType<typeof setTimeout> | null = null
let stepTimer: ReturnType<typeof setTimeout> | null = null
let xpRaf: number | null = null
let currentAppid = ''

function clearTimers(): void {
  if (hideTimer) clearTimeout(hideTimer)
  if (exitTimer) clearTimeout(exitTimer)
  if (stepTimer) clearTimeout(stepTimer)
  if (xpRaf !== null) cancelAnimationFrame(xpRaf)
  hideTimer = null
  exitTimer = null
  stepTimer = null
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

function fadeOutExpandedCopy(card: HTMLElement, onDone: () => void): void {
  const targets = card.querySelectorAll<HTMLElement>(TEXT_FADE_SELECTOR)

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
      stepTimer = setTimeout(onDone, TEXT_OUT_MS)
    })
  })
}

function clearInlineFadeStyles(card: HTMLElement): void {
  const targets = card.querySelectorAll<HTMLElement>(TEXT_FADE_SELECTOR)
  for (const el of targets) {
    el.style.animation = ''
    el.style.opacity = ''
    el.style.transition = ''
  }
}

function startSequence(card: HTMLElement, pointsEl: HTMLElement, tier: ToastTier): void {
  requestAnimationFrame(() => {
    card.classList.add('unlock-toast--play')

    if (prefersReducedMotion()) {
      card.classList.add('unlock-toast--expanded')
      card.classList.add('unlock-toast--xp')
      pointsEl.textContent = formatToastXp(tier)
      hideTimer = setTimeout(() => {
        card.classList.add('unlock-toast--exit')
        exitTimer = setTimeout(finish, EXIT_MS)
      }, VISIBLE_MS)
      return
    }

    // 1) Scale-in + settled icon hold, then expand from center.
    stepTimer = setTimeout(() => {
      card.classList.add('unlock-toast--expanded')
      card.classList.add('unlock-toast--xp')
      animateXpCount(pointsEl, toastXpForTier(tier), XP_COUNT_MS)

      // 2) Hold expanded, then shrink back to icon.
      hideTimer = setTimeout(() => {
        fadeOutExpandedCopy(card, () => {
          card.classList.remove('unlock-toast--xp')
          card.classList.remove('unlock-toast--expanded')
          clearInlineFadeStyles(card)

          // 3) Icon-only hold, then exit.
          stepTimer = setTimeout(() => {
            card.classList.add('unlock-toast--exit')
            exitTimer = setTimeout(finish, EXIT_MS)
          }, SHRINK_MS + ICON_HOLD_END_MS)
        })
      }, EXPAND_MS + VISIBLE_MS)
    }, PRE_EXPAND_MS)
  })
}

/**
 * Measures natural content width, sets `--toast-expanded`, resizes the overlay.
 *
 * @param card - Toast root button already in the DOM.
 */
async function fitWindowToCard(card: HTMLElement): Promise<void> {
  card.classList.add('unlock-toast--measure')
  const measured = card.getBoundingClientRect().width
  card.classList.remove('unlock-toast--measure')

  const panelWidth = clampToastPanelWidth(measured)
  card.style.setProperty('--toast-expanded', `${panelWidth}px`)
  await window.toastApi.resize(toastWindowWidthFromCard(panelWidth))
}

function appendIcon(iconWrap: HTMLElement, iconUrl: string | undefined): void {
  if (iconUrl) {
    const img = document.createElement('img')
    img.className = 'unlock-toast__icon'
    img.src = iconUrl
    img.alt = ''
    img.width = 64
    img.height = 64
    img.onerror = () => {
      const fallback = document.createElement('span')
      fallback.className = 'unlock-toast__icon-fallback'
      fallback.setAttribute('aria-hidden', 'true')
      img.replaceWith(fallback)
    }
    iconWrap.appendChild(img)
    return
  }

  const fallback = document.createElement('span')
  fallback.className = 'unlock-toast__icon-fallback'
  fallback.setAttribute('aria-hidden', 'true')
  iconWrap.appendChild(fallback)
}

function renderToast(payload: UnlockToastPayload): void {
  clearTimers()
  currentAppid = payload.appid
  const tier: ToastTier = payload.tier || 'bronze'
  const isPlatinum = tier === 'platinum'
  const gameName = payload.gameName?.trim() ?? ''
  const description = payload.description?.trim() ?? ''

  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'unlock-toast'
  card.dataset.tier = tier
  const ariaParts = [
    isPlatinum ? 'Platinum unlocked' : 'Achievement unlocked',
    payload.displayName,
    gameName
  ].filter(Boolean)
  card.setAttribute('aria-label', ariaParts.join(', '))

  const points = document.createElement('span')
  points.className = 'unlock-toast__points'
  points.textContent = '+0'
  points.setAttribute('aria-hidden', 'true')

  const shell = document.createElement('span')
  shell.className = 'unlock-toast__shell'

  const panel = document.createElement('span')
  panel.className = 'unlock-toast__panel'

  const inner = document.createElement('span')
  inner.className = 'unlock-toast__inner'

  const content = document.createElement('span')
  content.className = 'unlock-toast__content'

  const iconWrap = document.createElement('span')
  iconWrap.className = 'unlock-toast__icon-wrap'
  appendIcon(iconWrap, payload.iconUrl)

  const overlays = document.createElement('span')
  overlays.className = 'unlock-toast__overlays'
  overlays.setAttribute('aria-hidden', 'true')

  const dark = document.createElement('span')
  dark.className = 'unlock-toast__dark'
  const ellipses = document.createElement('span')
  ellipses.className = 'unlock-toast__ellipses'
  const trophy = document.createElement('span')
  trophy.className = 'unlock-toast__trophy'
  overlays.append(dark, ellipses, trophy)
  iconWrap.appendChild(overlays)

  const body = document.createElement('span')
  body.className = 'unlock-toast__body'

  const nameEl = document.createElement('span')
  nameEl.className = 'unlock-toast__name'
  nameEl.textContent = payload.displayName
  body.appendChild(nameEl)

  if (description) {
    const descEl = document.createElement('span')
    descEl.className = 'unlock-toast__description'
    descEl.textContent = description
    body.appendChild(descEl)
  }

  content.append(iconWrap, body)
  inner.appendChild(content)
  panel.appendChild(inner)
  shell.append(points, panel)
  card.appendChild(shell)
  root.replaceChildren(card)

  card.addEventListener('click', () => {
    window.toastApi.click(currentAppid)
    finish()
  })

  void fitWindowToCard(card)
    .catch(() => undefined)
    .then(() => {
      startSequence(card, points, tier)
    })
}

window.toastApi.onShow(renderToast)
window.toastApi.ready()
