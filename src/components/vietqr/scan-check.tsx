import {useEffect, useState} from 'react'
import {TriangleAlert} from 'lucide-react'
import type {Scene} from '#/lib/qr/scene'
import {renderSceneToCanvas} from '#/lib/qr/export'
import {useT} from '#/i18n'

type Status = 'idle' | 'checking' | 'ok' | 'bad'

/** Renders the QR scene and decodes it back: true/false, or null when the check itself failed. */
async function scansBack(scene: Scene, payload: string): Promise<boolean | null> {
  try {
    const canvas = await renderSceneToCanvas(scene, 1.5)
    const {verifyCanvas} = await import('#/lib/scan')
    return await verifyCanvas(canvas, payload)
  } catch {
    return null
  }
}

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
    const id = window.setTimeout(() => {
      void scansBack(qrScene, payload).then((ok) => {
        if (!cancelled) setStatus(ok === null ? 'idle' : ok ? 'ok' : 'bad')
      })
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [qrScene, payload])
  return status
}

/** Warns when the rendered code may be hard to scan; a code that scans well needs no message. */
export function ScanCheckBadge({status}: {status: Status}) {
  const t = useT()
  if (status !== 'bad') return null
  return (
    <span role="status" className="inline-flex items-center gap-1.5 self-start rounded-full bg-warning-muted px-2.5 py-1 text-xs font-semibold text-on-warning-muted">
      <TriangleAlert size={14} aria-hidden />
      {t('gen.scanCheckBad')}
    </span>
  )
}
