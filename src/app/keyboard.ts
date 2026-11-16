import {useMediaQuery} from '@astryxdesign/core/hooks'
import {isIos} from './pwa'

const COARSE_POINTER = '(pointer: coarse)'

/** Touch-first device: focusing a field opens the on-screen keyboard. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER)
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number', 'password'])

function isTextEntry(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement)
    return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled
  return el instanceof HTMLElement && el.isContentEditable
}

/** iOS keeps the keyboard up exactly while a field has focus; elsewhere, check that it really shows. */
function keyboardShown(): boolean {
  const vv = window.visualViewport
  if (!vv || isIos()) return true
  return window.innerHeight - vv.height * vv.scale > 120
}

/**
 * Sets `<html data-typing>` while the user types into a field on a touch device.
 * The keyboard then owns the bottom of the screen, as in native apps, and iOS
 * Safari detaches fixed bars from the visible area while it is up (a bottom tab
 * bar ends up floating mid-page on scroll), so CSS hides those bars meanwhile.
 * Call once at startup.
 */
export function trackTyping(): void {
  if (typeof window === 'undefined') return
  const coarse = window.matchMedia(COARSE_POINTER)
  const update = () => {
    const typing = coarse.matches && isTextEntry(document.activeElement) && keyboardShown()
    document.documentElement.toggleAttribute('data-typing', typing)
  }
  document.addEventListener('focusin', update)
  // focusout fires before the next field takes focus: decide once focus has settled.
  document.addEventListener('focusout', () => requestAnimationFrame(update))
  window.visualViewport?.addEventListener('resize', update)
}
