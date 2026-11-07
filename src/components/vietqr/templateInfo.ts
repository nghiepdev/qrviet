import type {TemplateInfo, TemplateLabels} from '#/lib/qr/templates'
import {amountToWords, formatVnd} from '#/lib/money'
import {maskAccount} from '#/lib/vietqr'
import {groupDigits} from '#/lib/text'
import {bankLogoUrl, type Bank} from '#/data/banks'
import type {TFunction} from '#/i18n'
import type {Locale, QrDesign} from '#/stores/settings'

export function templateLabels(t: TFunction): TemplateLabels {
  return {
    transfer: t('tpl.transfer'),
    bank: t('bank.label'),
    accountName: t('gen.accountName'),
    accountNumber: t('gen.account'),
    amount: t('gen.amount'),
    purpose: t('gen.purpose'),
    scanToPay: t('tpl.scanToPay'),
    scanHint: t('tpl.scanHint'),
    acceptedEverywhere: t('tpl.accepted'),
    madeWith: t('tpl.madeWith'),
  }
}

export function buildTemplateInfo(opts: {
  bank?: Bank | null
  accountName?: string
  accountNumber?: string
  amount?: number | null
  purpose?: string
  design: Pick<QrDesign, 'accent' | 'showBrand' | 'maskAccount' | 'title'>
  locale: Locale
  t: TFunction
}): TemplateInfo {
  const {bank, design, locale, t} = opts
  const acc = opts.accountNumber ?? ''
  return {
    bankShort: bank?.shortName,
    bankName: bank?.name,
    bankLogo: bankLogoUrl(bank),
    accountName: opts.accountName || undefined,
    accountNumber: acc ? (design.maskAccount ? maskAccount(acc) : groupDigits(acc)) : undefined,
    amount: opts.amount ?? null,
    amountText: opts.amount ? formatVnd(opts.amount, true) : undefined,
    amountWords: opts.amount ? amountToWords(opts.amount, locale) : undefined,
    purpose: opts.purpose || undefined,
    title: design.title || undefined,
    labels: templateLabels(t),
    accent: design.accent,
    showBrand: design.showBrand,
  }
}
