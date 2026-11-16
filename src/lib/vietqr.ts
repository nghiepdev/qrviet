/**
 * VietQR (NAPAS 247) payload builder & parser.
 *
 * Field order follows the NAPAS spec: 00 · 01 · 38 · 53 · 54 · 58 · 59 · 60 · 62 · 63
 *   38 = 00:A000000727 · 01:{00:BIN 01:account/card} · 02:QRIBFTTA|QRIBFTTC
 *   62 = 01 bill number · 05 reference label · 08 purpose (each ANS ≤ 25 per spec)
 */
import {
  checkCrc,
  findField,
  parseTlv,
  splitCrc,
  tlv,
  withCrc,
  type CrcCheck,
  type TlvField,
} from './emv.ts'
import {removeDiacritics} from './text.ts'

export const NAPAS_GUID = 'A000000727'
export const SERVICE_ACCOUNT = 'QRIBFTTA'
export const SERVICE_CARD = 'QRIBFTTC'

/** NAPAS spec limit for 62-08; many bank apps accept longer text, so we warn but allow up to MAX. */
export const PURPOSE_SPEC_LIMIT = 25
export const PURPOSE_MAX = 50
export const ACCOUNT_MAX = 19
export const AMOUNT_MAX_DIGITS = 13
/** Napas 247 fast transfer max per transaction (must be under 500,000,000 VND). */
export const AMOUNT_MAX = 499_999_999

export type VietQrService = 'account' | 'card'
export type Initiation = 'auto' | 'static' | 'dynamic'

export interface VietQrInput {
  bin: string
  accountNumber: string
  service?: VietQrService
  amount?: number | string | null
  purpose?: string
  billNumber?: string
  referenceLabel?: string
  /** Tag 59 — optional, most personal VietQR codes leave it out. */
  merchantName?: string
  /** Tag 60 — optional. */
  merchantCity?: string
  initiation?: Initiation
}

export interface VietQrIssue {
  field: keyof VietQrInput
  code:
    | 'required'
    | 'bin-format'
    | 'account-format'
    | 'account-length'
    | 'amount-format'
    | 'amount-too-large'
    | 'purpose-long'
    | 'purpose-too-long'
    | 'dynamic-needs-amount'
  severity: 'error' | 'warning'
}

/** Printable ASCII only — anything else would break the length-prefixed TLV. */
export function toQrAscii(input: string): string {
  return removeDiacritics(input)
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalise an amount to the digits-only string tag 54 expects ('' when empty/zero). */
export function normalizeAmount(amount: VietQrInput['amount']): string {
  if (amount === null || amount === undefined || amount === '') return ''
  let n: number
  if (typeof amount === 'number') n = amount
  else {
    const v = amount.trim()
    // "50000.00" is a decimal (EMV allows it); "1.234.567" is Vietnamese grouping.
    n =
      /^\d+(\.\d+)?$/.test(v) && !/^\d{1,3}(\.\d{3})+$/.test(v)
        ? Number(v)
        : Number(v.replace(/[^\d]/g, '') || '0')
  }
  if (!Number.isFinite(n) || n <= 0) return ''
  // BigInt keeps huge values as plain digits (never "1e+23"), so the 13-digit check stays honest.
  return BigInt(Math.round(n)).toString()
}

export function validateVietQr(input: VietQrInput): VietQrIssue[] {
  const issues: VietQrIssue[] = []
  if (!input.bin) issues.push({field: 'bin', code: 'required', severity: 'error'})
  else if (!/^\d{6}$/.test(input.bin))
    issues.push({field: 'bin', code: 'bin-format', severity: 'error'})

  const acc = input.accountNumber.trim()
  if (!acc) issues.push({field: 'accountNumber', code: 'required', severity: 'error'})
  else if (!/^[0-9A-Za-z]+$/.test(acc))
    issues.push({field: 'accountNumber', code: 'account-format', severity: 'error'})
  else if (acc.length > ACCOUNT_MAX)
    issues.push({field: 'accountNumber', code: 'account-length', severity: 'error'})

  if (input.amount !== undefined && input.amount !== null && input.amount !== '') {
    const raw = typeof input.amount === 'number' ? String(input.amount) : input.amount
    if (
      typeof input.amount === 'number'
        ? !Number.isFinite(input.amount) || input.amount < 0
        : /[^\d.,\s]/.test(raw)
    ) {
      issues.push({field: 'amount', code: 'amount-format', severity: 'error'})
    } else {
      const normalized = normalizeAmount(input.amount)
      if (
        normalized &&
        (normalized.length > AMOUNT_MAX_DIGITS || BigInt(normalized) > BigInt(AMOUNT_MAX))
      ) {
        issues.push({field: 'amount', code: 'amount-too-large', severity: 'error'})
      }
    }
  }

  const purpose = toQrAscii(input.purpose ?? '')
  if (purpose.length > PURPOSE_MAX)
    issues.push({field: 'purpose', code: 'purpose-too-long', severity: 'error'})
  else if (purpose.length > PURPOSE_SPEC_LIMIT)
    issues.push({field: 'purpose', code: 'purpose-long', severity: 'warning'})

  if (input.initiation === 'dynamic' && !normalizeAmount(input.amount)) {
    issues.push({field: 'amount', code: 'dynamic-needs-amount', severity: 'warning'})
  }
  return issues
}

/** Build the EMV string. Throws on hard errors; call validateVietQr first for UI feedback. */
export function buildVietQr(input: VietQrInput): string {
  const errors = validateVietQr(input).filter((i) => i.severity === 'error')
  if (errors.length)
    throw new Error(`Invalid VietQR input: ${errors.map((e) => `${e.field}:${e.code}`).join(', ')}`)

  const account = input.accountNumber.trim().toUpperCase()
  const amount = normalizeAmount(input.amount)
  const purpose = toQrAscii(input.purpose ?? '').slice(0, PURPOSE_MAX)
  const bill = toQrAscii(input.billNumber ?? '').slice(0, PURPOSE_SPEC_LIMIT)
  const reference = toQrAscii(input.referenceLabel ?? '').slice(0, PURPOSE_SPEC_LIMIT)
  const name = toQrAscii(input.merchantName ?? '')
    .toUpperCase()
    .slice(0, 25)
  const city = toQrAscii(input.merchantCity ?? '')
    .toUpperCase()
    .slice(0, 15)

  const beneficiary = tlv('00', input.bin) + tlv('01', account)
  const tag38 =
    tlv('00', NAPAS_GUID) +
    tlv('01', beneficiary) +
    tlv('02', input.service === 'card' ? SERVICE_CARD : SERVICE_ACCOUNT)

  let additional = tlv('01', bill) + tlv('05', reference) + tlv('08', purpose)
  if (additional.length > 99) {
    // Keep the purpose, trim it so the whole template fits.
    const room = 99 - (tlv('01', bill) + tlv('05', reference)).length - 4
    additional =
      tlv('01', bill) + tlv('05', reference) + tlv('08', purpose.slice(0, Math.max(0, room)))
  }

  const dynamic =
    input.initiation === 'dynamic' ||
    (input.initiation !== 'static' && (Boolean(amount) || Boolean(bill) || Boolean(reference)))

  const body =
    tlv('00', '01') +
    tlv('01', dynamic ? '12' : '11') +
    tlv('38', tag38) +
    tlv('53', '704') +
    tlv('54', amount) +
    tlv('58', 'VN') +
    tlv('59', name) +
    tlv('60', city) +
    tlv('62', additional)
  return withCrc(body)
}

export interface ParsedVietQr {
  kind: 'vietqr'
  raw: string
  bin: string
  accountNumber: string
  service: VietQrService | 'unknown'
  serviceCode: string
  amount: string
  currency: string
  country: string
  merchantName: string
  merchantCity: string
  purpose: string
  billNumber: string
  referenceLabel: string
  initiation: 'static' | 'dynamic' | 'unknown'
  crc: CrcCheck
  fields: TlvField[]
}

export interface ParsedEmv {
  kind: 'emv'
  raw: string
  crc: CrcCheck
  fields: TlvField[]
  /** Merchant account templates present (26–51) with their GUIDs, e.g. Visa/Mastercard/other schemes. */
  schemes: string[]
}

export type EmvParseResult = ParsedVietQr | ParsedEmv

/** Looks like an EMV MPM payload (starts with tag 00 = 01). */
export function looksLikeEmv(text: string): boolean {
  return text.trim().startsWith('000201')
}

/** Parse any EMV MPM payload; returns a VietQR view when the NAPAS GUID is present. */
export function parseEmvQr(text: string): EmvParseResult {
  const raw = text.trim()
  const crc = checkCrc(raw)
  // Parse the body without tag 63 so a missing/partial checksum ("…6304", "…6304AB")
  // or a checksum that happens to read "6304" never breaks parsing.
  const parts = splitCrc(raw)
  const fields: TlvField[] = parts ? parseTlv(parts.body) : parseTlv(raw)
  if (parts?.crc) fields.push({id: '63', length: 4, value: parts.crc})

  const napas = fields.find((f) => {
    const n = Number(f.id)
    return n >= 26 && n <= 51 && findField(f.children, '00')?.value.toUpperCase() === NAPAS_GUID
  })

  if (!napas) {
    const schemes = fields
      .filter((f) => Number(f.id) >= 2 && Number(f.id) <= 51)
      .map((f) => findField(f.children, '00')?.value ?? `tag ${f.id}`)
    return {kind: 'emv', raw, crc, fields, schemes}
  }

  const beneficiary = findField(napas.children, '01')
  const nested = beneficiary?.children ?? (beneficiary ? safeParse(beneficiary.value) : undefined)
  const serviceCode = findField(napas.children, '02')?.value ?? ''
  const additional = findField(fields, '62')
  const poi = findField(fields, '01')?.value

  return {
    kind: 'vietqr',
    raw,
    bin: findField(nested, '00')?.value ?? '',
    accountNumber: findField(nested, '01')?.value ?? '',
    service:
      serviceCode === SERVICE_ACCOUNT
        ? 'account'
        : serviceCode === SERVICE_CARD
          ? 'card'
          : 'unknown',
    serviceCode,
    amount: findField(fields, '54')?.value ?? '',
    currency: findField(fields, '53')?.value ?? '',
    country: findField(fields, '58')?.value ?? '',
    merchantName: findField(fields, '59')?.value ?? '',
    merchantCity: findField(fields, '60')?.value ?? '',
    purpose: findField(additional?.children, '08')?.value ?? '',
    billNumber: findField(additional?.children, '01')?.value ?? '',
    referenceLabel: findField(additional?.children, '05')?.value ?? '',
    initiation: poi === '11' ? 'static' : poi === '12' ? 'dynamic' : 'unknown',
    crc,
    fields,
  }
}

function safeParse(value: string): TlvField[] | undefined {
  try {
    return parseTlv(value, '01', 2)
  } catch {
    return undefined
  }
}

/** Mask the middle of an account number: 0123456789 → 012****789. */
export function maskAccount(account: string, visible = 3): string {
  if (account.length <= visible * 2) return account
  return (
    account.slice(0, visible) + '*'.repeat(account.length - visible * 2) + account.slice(-visible)
  )
}
