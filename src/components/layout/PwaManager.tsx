import {useEffect, useRef} from 'react'
import {useRegisterSW} from 'virtual:pwa-register/react'
import {Button} from '@astryxdesign/core/Button'
import {useToast} from '@astryxdesign/core/Toast'
import {useT} from '#/i18n'
import {useOnline} from '#/app/pwa'

const UPDATE_CHECK_MS = 60 * 60 * 1000

/** Service-worker lifecycle → toasts: offline-ready, update available, connectivity changes. */
export function PwaManager() {
  const t = useT()
  const showToast = useToast()
  const online = useOnline()
  const prevOnline = useRef(online)

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Installed apps can stay open for days: look for updates hourly while online.
      setInterval(() => {
        if (navigator.onLine && registration.installing === null) void registration.update()
      }, UPDATE_CHECK_MS)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    showToast({
      body: t('app.updateReady'),
      isAutoHide: false,
      uniqueID: 'sw-update',
      endContent: <Button label={t('app.updateAction')} size="sm" variant="primary" onClick={() => void updateServiceWorker(true)} />,
    })
  }, [needRefresh, showToast, t, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady) return
    showToast({body: t('app.offlineReady'), uniqueID: 'sw-ready'})
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, showToast, t])

  // Only announce real connectivity changes (not re-renders, e.g. a language switch).
  useEffect(() => {
    if (prevOnline.current === online) return
    prevOnline.current = online
    showToast({body: online ? t('app.backOnline') : t('app.offlineHint'), uniqueID: 'net'})
  }, [online, showToast, t])

  return null
}
