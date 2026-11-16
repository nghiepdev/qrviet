import {ExternalLink, Smartphone, Zap} from 'lucide-react'
import {Badge} from '@astryxdesign/core/Badge'
import {getBankDeeplinkTier, type Bank} from '#/data/banks'
import {useT} from '#/i18n'

export function BankDeeplinkBadge({bank, compact = false}: {bank: Bank; compact?: boolean}) {
  const t = useT()
  const tier = getBankDeeplinkTier(bank)
  if (tier === 'none') return null
  if (tier === 'autofill') {
    return (
      <Badge
        variant="blue"
        label={compact ? t('bank.tagAutofillShort') : t('bank.tagAutofill')}
        icon={<Zap size={11} />}
      />
    )
  }
  if (tier === 'qrpay') {
    return (
      <Badge
        variant="teal"
        label={compact ? t('bank.tagQrPayShort') : t('bank.tagQrPay')}
        icon={<Smartphone size={11} />}
      />
    )
  }
  return <Badge variant="purple" label={t('bank.tagOpenApp')} icon={<ExternalLink size={11} />} />
}
