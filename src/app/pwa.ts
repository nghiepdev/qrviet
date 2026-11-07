/** PWA runtime state: install prompt, standalone mode and connectivity. */
import {useSyncExternalStore} from 'react'
import {createStore, useSelector} from '@tanstack/react-store'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null
  installed: boolean
}

export const pwaStore = createStore<PwaState>({installEvent: null, installed: false})

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & {standalone?: boolean}).standalone === true
  )
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Call once at startup, before React renders, so the event is never missed. */
export function capturePwaEvents() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pwaStore.setState((s) => ({...s, installEvent: e as BeforeInstallPromptEvent}))
  })
  window.addEventListener('appinstalled', () => {
    pwaStore.setState(() => ({installEvent: null, installed: true}))
  })
}

export function useInstallState() {
  const canPrompt = useSelector(pwaStore, (s) => s.installEvent !== null)
  const installed = useSelector(pwaStore, (s) => s.installed)
  return {canPrompt, installed: installed || isStandalone(), ios: isIos()}
}

export async function promptInstall(): Promise<boolean> {
  const evt = pwaStore.state.installEvent
  if (!evt) return false
  await evt.prompt()
  const choice = await evt.userChoice
  pwaStore.setState((s) => ({...s, installEvent: null, installed: choice.outcome === 'accepted'}))
  return choice.outcome === 'accepted'
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}
