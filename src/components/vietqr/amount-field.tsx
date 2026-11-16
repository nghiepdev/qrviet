import {Volume2, X} from 'lucide-react'
import {TextInput} from '@astryxdesign/core/TextInput'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Banknote} from 'lucide-react'
import {amountToWords, formatVnd, parseAmount, shortAmount} from '#/lib/money'
import {heatStyle} from '#/components/common/icon-badge'
import {useLocale, useT} from '#/i18n'

const QUICK = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000]

export function speakAmount(text: string, locale: 'vi' | 'en') {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = locale === 'vi' ? 'vi-VN' : 'en-US'
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith(locale === 'vi' ? 'vi' : 'en'))
  if (voice) u.voice = voice
  u.rate = 0.95
  speechSynthesis.speak(u)
}

interface Props {
  value: string
  onChange: (text: string) => void
  label?: string
  error?: string
  showQuick?: boolean
  description?: string
}

/** Smart amount input: "150k", "1tr2", "1.500.000" → VND, with quick chips and words. */
export function AmountField({value, onChange, label, error, showQuick = true, description}: Props) {
  const t = useT()
  const locale = useLocale()
  const amount = parseAmount(value)
  const words = amount ? amountToWords(amount, locale) : ''
  const canSpeak = typeof speechSynthesis !== 'undefined'

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        label={label ?? t('gen.amount')}
        value={value}
        onChange={onChange}
        placeholder={t('gen.amountPlaceholder')}
        inputMode="text"
        enterKeyHint="next"
        autoComplete="off"
        startIcon={Banknote}
        isOptional
        hasClear
        description={description ?? t('gen.amountHint')}
        status={error ? {type: 'error', message: error} : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && amount) onChange(formatVnd(amount))
        }}
        controlStyle={{fontVariantNumeric: 'tabular-nums'}}
      />
      {amount ? (
        <div className="flex items-start gap-2 rounded-md bg-accent-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-accent qv-num leading-tight">
              {formatVnd(amount, true)}
            </div>
            <div className="text-xs text-secondary italic">{words}</div>
          </div>
          {canSpeak && (
            <IconButton
              label={t('gen.speak')}
              icon={<Volume2 size={16} />}
              size="sm"
              variant="ghost"
              onClick={() => speakAmount(words, locale)}
            />
          )}
          <IconButton
            label={t('common.clear')}
            icon={<X size={16} />}
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
          />
        </div>
      ) : null}
      {showQuick && (
        <div
          className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5"
          role="group"
          aria-label={t('gen.quickAmounts')}
        >
          {/* Warmer as the amount grows: amber up to red. */}
          {QUICK.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange(formatVnd(q))}
              aria-pressed={amount === q}
              style={heatStyle(i, QUICK.length)}
              className="qv-tile qv-tile-hue qv-heat qv-heat-money shrink-0 px-3 py-1 rounded-full text-sm font-semibold qv-num qv-hue-text"
            >
              {shortAmount(q, locale)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
