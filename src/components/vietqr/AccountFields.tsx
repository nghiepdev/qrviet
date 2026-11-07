import {ClipboardPaste, CreditCard, Hash, Landmark, UserRound} from 'lucide-react'
import {TextInput} from '@astryxdesign/core/TextInput'
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl'
import {IconButton} from '@astryxdesign/core/IconButton'
import {BankPicker} from '#/components/bank/BankPicker'
import {normalizeAccountName, normalizeAccountNumber} from '#/lib/text'
import {useT, type MessageKey} from '#/i18n'
import type {VietQrForm} from './form'

interface Props {
  form: Pick<VietQrForm, 'bin' | 'accountNumber' | 'accountName' | 'service'>
  onChange: (patch: Partial<VietQrForm>) => void
  errors?: Partial<Record<'bin' | 'accountNumber', MessageKey>>
  showErrors?: boolean
  showName?: boolean
}

/** Bank + destination type + account number + holder name. */
export function AccountFields({form, onChange, errors = {}, showErrors = false, showName = true}: Props) {
  const t = useT()
  const pasteAccount = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const value = normalizeAccountNumber(text)
      if (value) onChange({accountNumber: value})
    } catch {
      /* clipboard not permitted */
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <BankPicker
        value={form.bin}
        onChange={(bin) => onChange({bin})}
        isRequired
        error={showErrors && errors.bin ? t(errors.bin) : undefined}
      />
      <SegmentedControl label={t('gen.service')} value={form.service} onChange={(v) => onChange({service: v as VietQrForm['service']})} layout="fill" size="sm">
        <SegmentedControlItem value="account" label={t('gen.serviceAccount')} icon={<Landmark size={14} />} />
        <SegmentedControlItem value="card" label={t('gen.serviceCard')} icon={<CreditCard size={14} />} />
      </SegmentedControl>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <TextInput
            label={form.service === 'card' ? t('gen.card') : t('gen.account')}
            value={form.accountNumber}
            onChange={(v) => onChange({accountNumber: normalizeAccountNumber(v)})}
            placeholder={t('gen.accountPlaceholder')}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            startIcon={Hash}
            isRequired
            hasClear
            hasSpellCheck={false}
            hasAutoCorrect={false}
            autoCapitalize="characters"
            status={showErrors && errors.accountNumber ? {type: 'error', message: t(errors.accountNumber)} : undefined}
            controlClassName="qv-mono"
          />
        </div>
        {typeof navigator !== 'undefined' && 'clipboard' in navigator && 'readText' in navigator.clipboard && (
          <IconButton label={t('common.import')} tooltip="Paste" icon={<ClipboardPaste size={18} />} variant="secondary" onClick={() => void pasteAccount()} />
        )}
      </div>
      {showName && (
        <TextInput
          label={t('gen.accountName')}
          value={form.accountName}
          onChange={(v) => onChange({accountName: normalizeAccountName(v)})}
          placeholder={t('gen.accountNamePlaceholder')}
          description={t('gen.accountNameHint')}
          startIcon={UserRound}
          autoComplete="name"
          autoCapitalize="characters"
          isOptional
          hasClear
        />
      )}
    </div>
  )
}
