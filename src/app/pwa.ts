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
  iosGuideOpen: boolean
}

export const pwaStore = createStore<PwaState>({
  installEvent: null,
  installed: false,
  iosGuideOpen: false,
})

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
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Call once at startup, before React renders, so the event is never missed. */
export function capturePwaEvents() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pwaStore.setState((s) => ({...s, installEvent: e as BeforeInstallPromptEvent}))
  })
  window.addEventListener('appinstalled', () => {
    pwaStore.setState((s) => ({...s, installEvent: null, installed: true}))
  })
}

export function useInstallState() {
  const canPrompt = useSelector(pwaStore, (s) => s.installEvent !== null)
  const installed = useSelector(pwaStore, (s) => s.installed)
  return {canPrompt, installed: installed || isStandalone(), ios: isIos()}
}

const IOS_GUIDE_VIDEO_SRC = `${import.meta.env.BASE_URL}guides/safari-install.mp4`
const IOS_GUIDE_PRELOAD_TIMEOUT_MS = 8000

let iosGuideVideoLoaded = false
let iosGuidePreloadPromise: Promise<void> | null = null

export function preloadIosInstallGuideVideo(): Promise<void> {
  if (typeof document === 'undefined' || iosGuideVideoLoaded) return Promise.resolve()
  if (iosGuidePreloadPromise) return iosGuidePreloadPromise

  iosGuidePreloadPromise = new Promise<void>((resolve) => {
    const video = document.createElement('video')
    video.src = IOS_GUIDE_VIDEO_SRC
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.setAttribute('aria-hidden', 'true')
    video.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0'

    let settled = false
    const finish = (loaded: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
      video.remove()
      if (loaded) iosGuideVideoLoaded = true
      iosGuidePreloadPromise = null
      resolve()
    }
    const onReady = () => finish(true)
    const onError = () => finish(false)
    const timer = window.setTimeout(() => finish(false), IOS_GUIDE_PRELOAD_TIMEOUT_MS)

    video.addEventListener('canplay', onReady, {once: true})
    video.addEventListener('loadeddata', onReady, {once: true})
    video.addEventListener('error', onError, {once: true})
    document.body.appendChild(video)
    video.load()
    if (video.readyState >= 2) finish(true)
  })

  return iosGuidePreloadPromise
}

export function setIosInstallGuideOpen(iosGuideOpen: boolean) {
  pwaStore.setState((s) => ({...s, iosGuideOpen}))
}

export async function openIosInstallGuide() {
  await preloadIosInstallGuideVideo()
  setIosInstallGuideOpen(true)
}

export function useIosInstallGuide() {
  const isOpen = useSelector(pwaStore, (s) => s.iosGuideOpen)
  return {isOpen, open: openIosInstallGuide, setOpen: setIosInstallGuideOpen}
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
