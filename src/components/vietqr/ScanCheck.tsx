import {useEffect, useState} from 'react'
import {CircleCheck, LoaderCircle, TriangleAlert} from 'lucide-react'
import type {Scene} from '#/lib/qr/scene'
import {renderSceneToCanvas} from '#/lib/qr/export'
import {useT} from '#/i18n'

type Status = 'idle' | 'checking' | 'ok' | 'bad'

/** Decode the rendered code in the background to prove it still scans with the chosen style. */
export function useScanCheck(qrScene: Scene | null, payload: string | null): Status {
  const [status, setStatus] = useState<Status>('idle')
  useEffect(() => {
    if (!qrScene || !payload) {
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('checking')
    const id = window.setTimeout(async () => {
      try {
        const canvas = await renderSceneToCanvas(qrScene, 1.5)
        const {verifyCanvas} = await import('#/lib/scan')
        const ok = await verifyCanvas(canvas, payload)
        if (!cancelled) setStatus(ok ? 'ok' : 'bad')
      } catch {
        if (!cancelled) setStatus('idle')
      }
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [qrScene, payload])
  return status
}

export function ScanCheckBadge({status}: {status: Status}) {
  const t = useT()
  if (status === 'idle') return null
  const map = {
    checking: {icon: <LoaderCircle size={14} className="animate-spin" aria-hidden />, text: t('gen.scanChecking'), cls: 'text-secondary bg-muted'},
    ok: {icon: <CircleCheck size={14} aria-hidden />, text: t('gen.scanCheckOk'), cls: 'text-on-success-muted bg-success-muted'},
    bad: {icon: <TriangleAlert size={14} aria-hidden />, text: t('gen.scanCheckBad'), cls: 'text-on-warning-muted bg-warning-muted'},
  }[status]
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.cls}`}>
      {map.icon}
      {map.text}
    </span>
  )
}
