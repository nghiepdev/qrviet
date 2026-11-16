import {useId, type ReactNode} from 'react'
import {sceneToSvg, type Scene} from '#/lib/qr/scene'

/** Live SVG preview of a scene on a soft stage. */
export function QrStage({
  scene,
  label,
  empty,
  checker,
  maxWidth = 420,
}: {
  scene: Scene | null
  label: string
  empty?: ReactNode
  checker?: boolean
  maxWidth?: number
}) {
  const rawId = useId()
  const prefix = `qv${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = scene ? sceneToSvg(scene, {idPrefix: prefix}) : ''
  return (
    <div className="qv-preview-stage rounded-xl p-4 sm:p-6 grid place-items-center min-h-72">
      {scene ? (
        <div
          role="img"
          aria-label={label}
          className={`qv-preview w-full animate-qv-pop ${checker ? 'qv-checker rounded-lg' : ''}`}
          style={{maxWidth: Math.min(maxWidth, scene.width)}}
          // The SVG is generated from our own scene graph with escaped text.
          dangerouslySetInnerHTML={{__html: svg}}
        />
      ) : (
        empty
      )}
    </div>
  )
}
