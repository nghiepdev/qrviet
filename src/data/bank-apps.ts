/**
 * Offline bank & e-wallet app deeplink registry for QRViet.
 *
 * Zero network calls at runtime: iOS URL schemes, App Store IDs, Play Store
 * package names and offline handoff formats ship directly in `bank-apps.json`
 * (refreshed by `pnpm sync:banks`).
 *
 * Keyed by uppercase bank/wallet code (`bank.code.toUpperCase()`, e.g. "MB",
 * "VCB", "MOMO", "KBANK") so it matches `src/data/banks.json` regardless of casing.
 */
import raw from './bank-apps.json'

export type HandoffFormat =
  | {readonly kind: 'qrPay'; readonly path: string}
  | {readonly kind: 'namABank'}
  | {readonly kind: 'momoP2P'}

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
   * - `autofill`: verified offline pre-fill (MB Bank `qrContent`, MoMo phone P2P)
   * - `qrpay`: passes VietQR payload via iOS `qrPay` / `namABank` transfer link (best-effort unsigned)
   * - `launch`: opens the app directly; account/amount details are copied to clipboard for manual paste
   */
  readonly tier: Exclude<BankDeeplinkTier, 'none'>
}

const SPECS = raw as readonly BankAppSpec[]

export const BANK_APPS_BY_CODE: ReadonlyMap<string, BankAppSpec> = new Map(SPECS.map((s) => [s.code.toUpperCase(), s]))

export function appStoreUrl(appId: string): string {
  return `https://apps.apple.com/vn/app/id${appId}`
}

export function playStoreUrl(pkg: string): string {
  return `https://play.google.com/store/apps/details?id=${pkg}`
}

export function marketUrl(pkg: string): string {
  return `market://details?id=${pkg}`
}
