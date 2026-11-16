import {TextInput} from '@astryxdesign/core/TextInput'
import {MessageSquareText} from 'lucide-react'
import {PURPOSE_MAX, PURPOSE_SPEC_LIMIT} from '#/lib/vietqr'
import {useT, type MessageKey} from '#/i18n'

interface Props {
  value: string
  ascii: string
  onChange: (v: string) => void
  error?: MessageKey
  warning?: MessageKey
}

export function PurposeField({value, ascii, onChange, error, warning}: Props) {
  const t = useT()
  const len = ascii.length
  const counterColor =
    len > PURPOSE_MAX ? 'text-error' : len > PURPOSE_SPEC_LIMIT ? 'text-warning' : 'text-secondary'
  const changed = ascii && ascii !== value.trim()
  return (
    <div className="flex flex-col gap-1.5">
      <TextInput
        label={t('gen.purpose')}
        value={value}
        onChange={onChange}
        placeholder={t('gen.purposePlaceholder')}
        startIcon={MessageSquareText}
        isOptional
        hasClear
        autoComplete="off"
        enterKeyHint="done"
        status={
          error
            ? {type: 'error', message: t(error)}
            : warning
              ? {type: 'warning', message: t(warning)}
              : undefined
        }
        statusVariant="detached"
      />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-secondary">
          {changed ? (
            <>
              → <span className="qv-mono">{ascii}</span>
            </>
          ) : (
            t('gen.purposeAscii')
          )}
        </span>
        <span className={`qv-num shrink-0 font-semibold ${counterColor}`} aria-live="polite">
          {len}/{PURPOSE_SPEC_LIMIT}
        </span>
      </div>
    </div>
  )
}
