import {CreditCard, QrCode, Square, Store, ScanQrCode} from 'lucide-react'
import {TEMPLATE_ACCENTS, TEMPLATE_IDS, type TemplateId} from '#/lib/qr/templates'
import {useT, type MessageKey} from '#/i18n'

const ICONS: Record<TemplateId, typeof QrCode> = {
  compact: ScanQrCode,
  card: CreditCard,
  minimal: Square,
  standee: Store,
  qr: QrCode,
}

export function TemplatePicker({value, onChange}: {value: TemplateId; onChange: (v: TemplateId) => void}) {
  const t = useT()
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('gen.templates')}>
      {TEMPLATE_IDS.map((id) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === value}
            onClick={() => onChange(id)}
            className="qv-tile flex flex-col items-center justify-center gap-1.5 px-1 py-2.5 text-[11px] sm:text-xs font-semibold text-secondary aria-checked:text-accent">
            <Icon size={20} aria-hidden />
            <span className="text-center leading-tight">{t(`tpl.${id}` as MessageKey)}</span>
          </button>
        )
      })}
    </div>
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
