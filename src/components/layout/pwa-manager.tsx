import {useEffect, useEffectEvent, useRef} from 'react'
import {getSerwist} from 'virtual:serwist'
import {Button} from '@astryxdesign/core/Button'
import {useToast} from '@astryxdesign/core/Toast'
import {useT} from '#/i18n'
import {useOnline} from '#/app/pwa'

const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Service-worker lifecycle → toasts: offline-ready on first install, "new version"
 * when an update is waiting (applied only when the user asks), connectivity changes.
 * Production only: dev runs without a service worker, so nothing is cached there.
 */
export function PwaManager() {
  const t = useT()
  const showToast = useToast()
  const online = useOnline()
  const prevOnline = useRef(online)

  const announceOfflineReady = useEffectEvent(() => showToast({body: t('app.offlineReady'), uniqueID: 'sw-ready'}))
  const offerUpdate = useEffectEvent((apply: () => void) =>
    showToast({
      body: t('app.updateReady'),
      isAutoHide: false,
      uniqueID: 'sw-update',
      endContent: <Button label={t('app.updateAction')} size="sm" variant="primary" onClick={apply} />,
    }),
  )

  useEffect(() => {
    if (import.meta.env.DEV) return
    let timer = 0
    void getSerwist().then(async (serwist) => {
      if (!serwist) return
      serwist.addEventListener('installed', (event) => {
        if (!event.isUpdate) announceOfflineReady()
      })
      // A new worker is installed and waiting: reload into it once the user agrees.
      serwist.addEventListener('waiting', () =>
        offerUpdate(() => {
          serwist.addEventListener('controlling', () => location.reload())
          serwist.messageSkipWaiting()
        }),
      )
      const registration = await serwist.register()
      // Installed apps can stay open for days: look for updates hourly while online.
      timer = window.setInterval(() => {
        if (navigator.onLine && registration?.installing === null) void registration.update()
      }, UPDATE_CHECK_MS)
    })
    return () => window.clearInterval(timer)
  }, [])

  // Only announce real connectivity changes (not re-renders, e.g. a language switch).
  useEffect(() => {
    if (prevOnline.current === online) return
    prevOnline.current = online
    showToast({body: online ? t('app.backOnline') : t('app.offlineHint'), uniqueID: 'net'})
  }, [online, showToast, t])

  return null
}
