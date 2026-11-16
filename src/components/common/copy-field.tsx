import {Copy} from 'lucide-react'
import {IconButton} from '@astryxdesign/core/IconButton'
import {useCopy} from '#/hooks/use-copy'
import {useT} from '#/i18n'

/** Label/value row with a one-tap copy button (payment page, scan results). */
export function CopyField({
  label,
  value,
  display,
  mono,
  emphasize,
}: {
  label: string
  value: string
  display?: string
  mono?: boolean
  emphasize?: boolean
}) {
  const copy = useCopy()
  const t = useT()
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-dashed border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-secondary">{label}</div>
        <div
          className={`${mono ? 'qv-mono' : ''} ${emphasize ? 'text-lg font-extrabold text-accent' : 'font-semibold'} break-words`}
        >
          {display ?? value}
        </div>
      </div>
      <IconButton
        label={`${t('common.copy')} ${label}`}
        icon={<Copy size={16} />}
        variant="ghost"
        size="sm"
        onClick={() => void copy(value, `${t('common.copied')}: ${label}`)}
      />
    </div>
  )
}
