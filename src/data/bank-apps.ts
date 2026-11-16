/**
 * Offline bank & e-wallet app deeplink registry for QRViet.
 *
 * Zero network calls at runtime: iOS/Android URL schemes, App Store IDs, Play
 * Store package names and offline handoff formats ship directly in
 * `bank-apps.json` (refreshed by `pnpm sync:banks`).
 *
 * Keyed by uppercase bank/wallet code (`bank.code.toUpperCase()`, e.g. "MB",
 * "VCB", "MOMO", "ZALOPAY") so it matches `src/data/banks.json` regardless of casing.
 */
import raw from './bank-apps.json'

export type HandoffFormat =
  | {readonly kind: 'qrPay'; readonly path: string; readonly param?: string}
  | {readonly kind: 'momoQr'}
  | {readonly kind: 'zalopayQr'}
  | {readonly kind: 'namABank'}

export type BankDeeplinkTier = 'autofill' | 'qrpay' | 'launch' | 'none'

export interface IosAppSpec {
  readonly scheme: string
  readonly appStoreId: string
  readonly handoff: HandoffFormat | null
}

export interface AndroidAppSpec {
  readonly package: string
}

export interface BankAppSpec {
  readonly code: string
  readonly ios: IosAppSpec
  readonly android: AndroidAppSpec
  /**
   * Honest offline autofill classification:
   * - `autofill`: verified offline VietQR pre-fill (MB, MoMo, ZaloPay, BIDV, TPBank, OCB, CAKE)
   * - `qrpay`: passes VietQR payload via `applink?qrContent=` (best-effort unsigned; varies by app version)
   * - `launch`: opens the app directly; account details are copied to clipboard for manual paste
   */
  readonly tier: Exclude<BankDeeplinkTier, 'none'>
}

const SPECS = raw as readonly BankAppSpec[]

export const BANK_APPS_BY_CODE: ReadonlyMap<string, BankAppSpec> = new Map(
  SPECS.map((s) => [s.code.toUpperCase(), s]),
)

export function appStoreUrl(appId: string): string {
  return `https://apps.apple.com/vn/app/id${appId}`
}

export function playStoreUrl(pkg: string): string {
  return `https://play.google.com/store/apps/details?id=${pkg}`
}

export function marketUrl(pkg: string): string {
  return `market://details?id=${pkg}`
}
