import raw from './banks.json'
import {BANK_APPS_BY_CODE, type BankAppSpec, type BankDeeplinkTier} from './bank-apps'
import {foldForSearch} from '#/lib/text'

export type {BankAppSpec, BankDeeplinkTier} from './bank-apps'

export interface Bank {
  bin: string
  code: string
  shortName: string
  name: string
  swift: string | null
  transfer: boolean
  lookup: boolean
  logo: string | null
  icon?: string | null
}

export const BANKS: Bank[] = raw as Bank[]

const byBin = new Map(BANKS.map((b) => [b.bin, b]))
const byCode = new Map(BANKS.map((b) => [b.code.toUpperCase(), b]))
const byShort = new Map(BANKS.map((b) => [b.shortName.toUpperCase(), b]))

export function getBankByBin(bin: string | null | undefined): Bank | undefined {
  return bin ? byBin.get(bin) : undefined
}

/** Accept a BIN, bank code or short name ("970436", "VCB", "Vietcombank"). */
export function resolveBank(ref: string | null | undefined): Bank | undefined {
  if (!ref) return undefined
  const v = ref.trim()
  return byBin.get(v) ?? byCode.get(v.toUpperCase()) ?? byShort.get(v.toUpperCase())
}

export function bankLogoUrl(bank: Bank | undefined | null): string | null {
  if (!bank?.logo) return null
  return `${import.meta.env.BASE_URL}${bank.logo}`
}

/** Square symbol mark for the center of a QR code, falling back to the full logo. */
export function bankIconUrl(bank: Bank | undefined | null): string | null {
  const path = bank?.icon ?? bank?.logo
  return path ? `${import.meta.env.BASE_URL}${path}` : null
}

/** Offline deeplink / app launch specification for a bank, if supported. */
export function getBankApp(bankOrRef: Bank | string | null | undefined): BankAppSpec | undefined {
  const bank = typeof bankOrRef === 'string' ? resolveBank(bankOrRef) : bankOrRef
  if (!bank) return undefined
  return BANK_APPS_BY_CODE.get(bank.code.toUpperCase())
}

export function getBankDeeplinkTier(bankOrRef: Bank | string | null | undefined): BankDeeplinkTier {
  return getBankApp(bankOrRef)?.tier ?? 'none'
}

export function hasBankDeeplink(bank: Bank | undefined | null): boolean {
  return getBankDeeplinkTier(bank) !== 'none'
}

export function hasBankQrHandoff(bank: Bank | undefined | null): boolean {
  const tier = getBankDeeplinkTier(bank)
  return tier === 'autofill' || tier === 'qrpay'
}

/** Most-used banks shown first in the picker. */
export const POPULAR_BINS = [
  '970436', // Vietcombank
  '970415', // VietinBank
  '970418', // BIDV
  '970405', // Agribank
  '970422', // MBBank
  '970407', // Techcombank
  '970416', // ACB
  '970432', // VPBank
  '970423', // TPBank
  '970403', // Sacombank
  '971025', // MoMo
  '971101', // ZaloPay
]

export const DEEPLINK_BANKS: Bank[] = BANKS.filter((b) => hasBankDeeplink(b))

const searchIndex = new Map(
  BANKS.map((b) => [
    b.bin,
    foldForSearch(`${b.shortName} ${b.code} ${b.name} ${b.bin} ${b.swift ?? ''}`),
  ]),
)

export function searchBanks(query: string, list: Bank[] = BANKS): Bank[] {
  const q = foldForSearch(query)
  if (!q) return list
  const tokens = q.split(' ')
  const scored: Array<[Bank, number]> = []
  for (const b of list) {
    const hay = searchIndex.get(b.bin) ?? ''
    if (!tokens.every((t) => hay.includes(t))) continue
    const short = foldForSearch(b.shortName)
    const code = b.code.toLowerCase()
    let score = 0
    if (short === q || code === q || b.bin === q) score += 100
    if (short.startsWith(q) || code.startsWith(q)) score += 50
    if (POPULAR_BINS.includes(b.bin)) score += 10
    if (b.transfer) score += 5
    scored.push([b, score])
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([b]) => b)
}

/** Deterministic brand-ish colour for banks without a logo. */
export function bankMonogramColor(code: string): string {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360
  return `hsl(${h} 62% 42%)`
}
