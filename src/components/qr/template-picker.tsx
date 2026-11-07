import {useEffect, useRef} from 'react'
import {CreditCard, QrCode, Square, Store, ScanQrCode} from 'lucide-react'
import {Carousel, type CarouselHandle} from '@astryxdesign/core/Carousel'
import {TEMPLATE_ACCENTS, TEMPLATE_IDS, type TemplateId} from '#/lib/qr/templates'
import {canAnchor} from '#/app/anchoring'
import {HUES, type Hue} from '#/components/common/icon-badge'
import {useT, type MessageKey} from '#/i18n'

/** Each template's tile hue. */
const TILE_HUES: Record<TemplateId, Hue> = {
  compact: 'red',
  card: 'blue',
  minimal: 'slate',
  standee: 'amber',
  qr: 'violet',
}

const ICONS: Record<TemplateId, typeof QrCode> = {
  compact: ScanQrCode,
  card: CreditCard,
  minimal: Square,
  standee: Store,
  qr: QrCode,
}

/**
 * Template tiles, the same on every screen: one Astryx Carousel row, with edge fades and prev/next
 * buttons when the tiles do not fit (swipe, trackpad and Shift + wheel scroll it too). Tiles keep
 * their width instead of stretching to fill a wide panel, and labels stay on one line.
 *
 * The buttons are anchored to the row, so browsers without anchor positioning (Safari before 26)
 * would draw them in the top-left corner of the screen; there they are left out.
 */
export function TemplatePicker({value, onChange}: {value: TemplateId; onChange: (v: TemplateId) => void}) {
  const t = useT()
  const carouselRef = useRef<CarouselHandle>(null)

  // Bring the current template into view once (with the tile before it for context), so a choice
  // near the end is not hidden off-screen. Waits a frame for the carousel to measure its items.
  useEffect(() => {
    const index = TEMPLATE_IDS.indexOf(value)
    if (index < 1) return
    const id = requestAnimationFrame(() => carouselRef.current?.scrollTo(index - 1))
    return () => cancelAnimationFrame(id)
    // Only the template selected when the picker mounts.
  }, [])

  return (
    <Carousel aria-label={t('gen.templates')} gap={2} handleRef={carouselRef} hasButtons={canAnchor}>
      {TEMPLATE_IDS.map((id) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            aria-pressed={id === value}
            onClick={() => onChange(id)}
            // Room for the 2px selection ring, which the carousel's scroll box would otherwise clip.
            className={`${HUES[TILE_HUES[id]]} qv-tile qv-tile-hue my-0.5 flex min-w-[6.125rem] flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-semibold whitespace-nowrap text-secondary pointer-coarse:min-w-[7.0625rem]`}>
            <Icon size={20} aria-hidden />
            <span>{t(`tpl.${id}` as MessageKey)}</span>
          </button>
        )
      })}
    </Carousel>
  )
}

export function AccentPicker({value, onChange, label}: {value: string; onChange: (v: string) => void; label: string}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {TEMPLATE_ACCENTS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c.toLowerCase() === value.toLowerCase()}
          aria-label={c}
          onClick={() => onChange(c)}
          className="qv-tile size-9 rounded-full p-1">
          <span className="block size-full rounded-full" style={{background: c}} />
        </button>
      ))}
      <label className="qv-tile size-9 rounded-full p-1 cursor-pointer relative overflow-hidden" title={label}>
        <span className="block size-full rounded-full" style={{background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={label} />
      </label>
    </div>
  )
}
