import {isIos, isStandalone} from './pwa'

/**
 * Sets `--qv-toolbar-overlap` on `<html>`: how much of the bottom of the page Safari's toolbar covers
 * without telling the page.
 *
 * In Safari on iPhone, a scroll to the very top made by script (every route change resets the scroll)
 * brings the collapsed bottom toolbar back over the page, but `innerHeight` and the visual viewport
 * keep the collapsed-toolbar size until the user scrolls. A `bottom: 0` bar then sits under the
 * toolbar. At the top of the page Safari always shows its toolbar, and the small viewport (the initial
 * containing block, `clientHeight`) is the part above it, so there the difference is the overlap.
 * Fixed bottom UI (tab bar, toasts, sheet footers) adds the variable to its bottom offset.
 *
 * It stays 0 elsewhere: in a consistent state `innerHeight` already equals the small viewport at the
 * top. Installed apps have no toolbar at all and are not tracked: their rubber-band bounce past the
 * top skews `innerHeight` against `clientHeight`, which read as an overlap and lifted the tab bar off
 * the bottom. For the same reason a bounce in Safari keeps the last value. Call once at startup.
 */
export function trackToolbarOverlap(): void {
  if (typeof window === 'undefined' || !isIos() || isStandalone()) return
  const root = document.documentElement
  let current = 0
  const update = () => {
    // Mid-bounce past the top (a negative scroll) the sizes are transient.
    if (window.scrollY < 0) return
    const overlap =
      window.scrollY === 0 ? Math.max(0, Math.round(window.innerHeight - root.clientHeight)) : 0
    if (overlap === current) return
    current = overlap
    root.style.setProperty('--qv-toolbar-overlap', `${overlap}px`)
  }
  window.addEventListener('scroll', update, {passive: true})
  window.addEventListener('resize', update)
  window.visualViewport?.addEventListener('resize', update)
  update()
}
