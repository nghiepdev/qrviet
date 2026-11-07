import {buildVietQr, toQrAscii, validateVietQr, type Initiation, type ParsedVietQr, type VietQrIssue, type VietQrService} from '#/lib/vietqr'
import {formatVnd, parseAmount} from '#/lib/money'
import {sanitizeTransferContent, type ContentMode} from '#/lib/text'
import type {SavedAccount} from '#/stores/accounts'
import type {MessageKey} from '#/i18n'
import {persistedStore} from '#/lib/persist'

export interface VietQrForm {
  bin: string
  accountNumber: string
  accountName: string
  service: VietQrService
  amountText: string
  purpose: string
  billNumber: string
  referenceLabel: string
  includeName: boolean
  merchantCity: string
  initiation: Initiation
}

export const EMPTY_FORM: VietQrForm = {
  bin: '',
  accountNumber: '',
  accountName: '',
  service: 'account',
  amountText: '',
  purpose: '',
  billNumber: '',
  referenceLabel: '',
  includeName: false,
  merchantCity: '',
  initiation: 'auto',
}

/** Last generator state, so reopening the app continues where you left off. */
export const draftStore = persistedStore<VietQrForm>({key: 'draft', version: 1, initial: EMPTY_FORM, merge: (p, i) => ({...i, ...p})})

export function formFromAccount(a: SavedAccount, keep?: Partial<VietQrForm>): VietQrForm {
  return {...EMPTY_FORM, ...keep, bin: a.bin, accountNumber: a.accountNumber, accountName: a.accountName, service: a.service}
}

export function formFromParsed(p: ParsedVietQr): VietQrForm {
  return {
    ...EMPTY_FORM,
    bin: p.bin,
    accountNumber: p.accountNumber,
    accountName: p.merchantName,
    service: p.service === 'card' ? 'card' : 'account',
    amountText: p.amount ? formatVnd(p.amount) : '',
    purpose: p.purpose,
    billNumber: p.billNumber,
    referenceLabel: p.referenceLabel,
    includeName: Boolean(p.merchantName),
    merchantCity: p.merchantCity,
  }
}

export const ISSUE_MESSAGE: Record<VietQrIssue['code'], MessageKey> = {
  required: 'gen.invalid.account',
  'bin-format': 'gen.invalid.bin',
  'account-format': 'gen.invalid.account',
  'account-length': 'gen.invalid.accountLength',
  'amount-format': 'gen.invalid.amount',
  'amount-too-large': 'gen.invalid.amountLarge',
  'purpose-long': 'gen.purposeLong',
  'purpose-too-long': 'gen.invalid.purpose',
  'dynamic-needs-amount': 'gen.invalid.amount',
}

export interface DerivedVietQr {
  payload: string | null
  amount: number | null
  purposeAscii: string
  issues: VietQrIssue[]
  /** Field → first error message key (only for fields the user touched or filled). */
  errors: Partial<Record<'bin' | 'accountNumber' | 'amount' | 'purpose', MessageKey>>
  warnings: Partial<Record<'purpose' | 'amount', MessageKey>>
}

export function deriveVietQr(form: VietQrForm, contentMode: ContentMode): DerivedVietQr {
  const amount = form.amountText.trim() ? parseAmount(form.amountText) : null
  const purposeClean = sanitizeTransferContent(form.purpose, contentMode).trim()
  const purposeAscii = toQrAscii(purposeClean)
  const issues = validateVietQr({
    bin: form.bin,
    accountNumber: form.accountNumber,
    amount: form.amountText.trim() && amount === null ? 'x' : (amount ?? undefined),
    purpose: purposeAscii,
    initiation: form.initiation,
  })
  const errors: DerivedVietQr['errors'] = {}
  const warnings: DerivedVietQr['warnings'] = {}
  for (const i of issues) {
    const key = i.field === 'bin' ? 'bin' : i.field === 'accountNumber' ? 'accountNumber' : i.field === 'amount' ? 'amount' : i.field === 'purpose' ? 'purpose' : null
    if (!key) continue
    const msg = i.field === 'bin' ? 'gen.invalid.bin' : ISSUE_MESSAGE[i.code]
    if (i.severity === 'error') errors[key] ??= msg
    else if (key === 'purpose' || key === 'amount') warnings[key] ??= msg
  }
  let payload: string | null = null
  if (!issues.some((i) => i.severity === 'error')) {
    try {
      payload = buildVietQr({
        bin: form.bin,
        accountNumber: form.accountNumber,
        service: form.service,
        amount: amount ?? undefined,
        purpose: purposeAscii,
        billNumber: form.billNumber,
        referenceLabel: form.referenceLabel,
        merchantName: form.includeName ? form.accountName : undefined,
        merchantCity: form.includeName ? form.merchantCity : undefined,
        initiation: form.initiation,
      })
    } catch {
      payload = null
    }
  }
  return {payload, amount, purposeAscii, issues, errors, warnings}
}

export function useDerivedVietQr(form: VietQrForm, contentMode: ContentMode): DerivedVietQr {
  return deriveVietQr(form, contentMode)
}
