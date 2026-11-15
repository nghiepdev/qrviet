/**
 * Client-side offline bank-app deeplink engine.
 *
 * Ports mobile deeplink orchestration strictly to the browser with zero network
 * calls: OS & In-App Browser detection, unsigned VietQR / MoMo P2P / Nam A Bank
 * handoff URL construction, and visibility/focus fallback monitoring for App Store
 * / Google Play.
 */
import {appStoreUrl, marketUrl, playStoreUrl} from '#/data/bank-apps'
import {getBankApp, type Bank, type BankAppSpec} from '#/data/banks'
import {buildVietQr, normalizeAmount, toQrAscii, type VietQrService} from '#/lib/vietqr'

export type Platform = 'ios' | 'android' | 'desktop'

export type InAppBrowserKind = 'zalo' | 'messenger' | 'facebook' | 'instagram' | 'tiktok' | 'line' | 'webview'

export interface InAppBrowserInfo {
  isInApp: boolean
  app: InAppBrowserKind | null
}

export interface BankLaunchPayment {
  bin: string
  accountNumber: string
  accountName?: string
  amount?: number | string | null
  purpose?: string
  service?: VietQrService | 'unknown'
  rawPayload?: string
}

export interface BankLaunchPlan {
  appBank: Bank
  spec: BankAppSpec
  os: Platform
  /** Native URL scheme to open (`mbbank://...`, `vietcombankmobile://`, etc.), or null on desktop. */
  launchUrl: string | null
  /** True when `launchUrl` carries transfer/QR payload parameters. */
  carriesPayload: boolean
  /**
   * Honest autofill expectation for this specific app + payment combination:
   * - `confirmed`: verified offline autofill (MB Bank `qrContent`, or MoMo P2P phone transfer)
   * - `qrpay`: unsigned `qrPay` / `namABank` transfer link on iOS (best-effort; depends on bank app)
   * - `none`: opens app home/scan only
   */
  autofillMode: 'confirmed' | 'qrpay' | 'none'
  /** Primary store link for the current OS (App Store on iOS, Play Store on Android). */
  storeUrl: string | null
  /** Direct Google Play app link (`market://`) on Android. */
  androidMarketUrl: string | null
  iosStoreUrl: string
  androidStoreUrl: string
}

const MOMO_BIN = '971025'
const VN_MOBILE = /^0[35789]\d{8}$/

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPad|iPhone|iPod/i.test(ua) || isIpadOs) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') return {isInApp: false, app: null}
  const ua = navigator.userAgent || ''
  if (/\bZalo/i.test(ua)) return {isInApp: true, app: 'zalo'}
  if (/\bMessenger|FB_IAB.*Messenger/i.test(ua)) return {isInApp: true, app: 'messenger'}
  if (/\bFBAN|FBAV|FB_IAB/i.test(ua)) return {isInApp: true, app: 'facebook'}
  if (/\bInstagram/i.test(ua)) return {isInApp: true, app: 'instagram'}
  if (/\bTikTok|BytedanceWebview|Musical_ly/i.test(ua)) return {isInApp: true, app: 'tiktok'}
  if (/\bLine\//i.test(ua)) return {isInApp: true, app: 'line'}

  const standalone =
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
    Boolean((navigator as {standalone?: boolean}).standalone)
  const isIos = detectPlatform() === 'ios'
  if (isIos && !standalone && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) {
    return {isInApp: true, app: 'webview'}
  }
  return {isInApp: false, app: null}
}

/** UTF-8 safe base64 encoding for browser runtimes. */
function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function resolveQrPayload(payment: BankLaunchPayment): string | null {
  if (payment.rawPayload?.trim()) return payment.rawPayload.trim()
  try {
    return buildVietQr({
      bin: payment.bin,
      accountNumber: payment.accountNumber,
      amount: payment.amount,
      purpose: payment.purpose,
      service: payment.service === 'card' ? 'card' : 'account',
      merchantName: payment.accountName,
    })
  } catch {
    return null
  }
}

function buildMomoP2PUrl(scheme: string, payment: BankLaunchPayment): string | null {
  const phone = payment.accountNumber.trim()
  if (payment.bin !== MOMO_BIN || payment.service === 'card' || !VN_MOBILE.test(phone)) return null
  const amount = Number(normalizeAmount(payment.amount)) || 0
  const data = {
    userId: phone,
    amount,
    message: toQrAscii(payment.purpose ?? ''),
  }
  const extra = JSON.stringify({dataExtract: utf8Base64(JSON.stringify(data))})
  return `${scheme}app?action=p2p&extra=${encodeURIComponent(extra)}`
}

function buildNamABankUrl(scheme: string, payment: BankLaunchPayment): string {
  const amount = normalizeAmount(payment.amount)
  const data = {
    bankId: payment.bin,
    accountNumber: payment.accountNumber.trim(),
    accountName: toQrAscii(payment.accountName ?? '').toUpperCase(),
    amount,
    description: toQrAscii(payment.purpose ?? ''),
    partnerName: 'QRViet',
    partnerId: '',
  }
  return `${scheme}ops.namabank.com.vn/?data=${encodeURIComponent(utf8Base64(JSON.stringify(data)))}`
}

export function buildBankLaunchPlan(
  appBank: Bank,
  payment: BankLaunchPayment,
  os: Platform = detectPlatform(),
): BankLaunchPlan | null {
  const spec = getBankApp(appBank)
  if (!spec) return null

  const iosStoreUrl = appStoreUrl(spec.ios.appStoreId)
  const androidStoreUrl = playStoreUrl(spec.android.package)
  const androidMarket = marketUrl(spec.android.package)

  if (os === 'desktop') {
    return {
      appBank,
      spec,
      os,
      launchUrl: null,
      carriesPayload: false,
      autofillMode: 'none',
      storeUrl: iosStoreUrl,
      androidMarketUrl: null,
      iosStoreUrl,
      androidStoreUrl,
    }
  }

  if (os === 'android') {
    return {
      appBank,
      spec,
      os,
      launchUrl: spec.ios.scheme,
      carriesPayload: false,
      autofillMode: 'none',
      storeUrl: androidStoreUrl,
      androidMarketUrl: androidMarket,
      iosStoreUrl,
      androidStoreUrl,
    }
  }

  // iOS
  const {handoff, scheme} = spec.ios
  let launchUrl = scheme
  let carriesPayload = false
  let autofillMode: BankLaunchPlan['autofillMode'] = 'none'

  if (handoff?.kind === 'qrPay') {
    const payload = resolveQrPayload(payment)
    if (payload) {
      launchUrl = `${scheme}${handoff.path}?targetPage=QRPay&qrContent=${encodeURIComponent(payload)}`
      carriesPayload = true
      autofillMode = spec.tier === 'autofill' ? 'confirmed' : 'qrpay'
    }
  } else if (handoff?.kind === 'namABank') {
    launchUrl = buildNamABankUrl(scheme, payment)
    carriesPayload = true
    autofillMode = 'qrpay'
  } else if (handoff?.kind === 'momoP2P') {
    const p2p = buildMomoP2PUrl(scheme, payment)
    if (p2p) {
      launchUrl = p2p
      carriesPayload = true
      autofillMode = 'confirmed'
    }
  }

  return {
    appBank,
    spec,
    os,
    launchUrl,
    carriesPayload,
    autofillMode,
    storeUrl: iosStoreUrl,
    androidMarketUrl: null,
    iosStoreUrl,
    androidStoreUrl,
  }
}

export type LaunchStatus = 'idle' | 'opening' | 'opened' | 'fallback'

/**
 * Trigger a native app URL synchronously inside a click handler, then monitor
 * document visibility / pagehide / blur for `timeoutMs` (default 1800ms) to
 * report whether the OS handed off to the bank app or stayed in the browser.
 */
export function launchNativeApp(
  url: string,
  onStatus: (status: Exclude<LaunchStatus, 'idle' | 'opening'>) => void,
  timeoutMs = 1800,
): () => void {
  let settled = false

  const finish = (status: Exclude<LaunchStatus, 'idle' | 'opening'>) => {
    if (settled) return
    settled = true
    cleanup()
    onStatus(status)
  }

  const onVisibility = () => {
    if (document.hidden) finish('opened')
  }
  const onPageHide = () => finish('opened')
  const onBlur = () => {
    window.setTimeout(() => {
      if (document.hidden || !document.hasFocus()) finish('opened')
    }, 150)
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('blur', onBlur)

  const timer = window.setTimeout(() => {
    finish(document.hidden ? 'opened' : 'fallback')
  }, timeoutMs)

  const cleanup = () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('blur', onBlur)
  }

  // Trigger synchronously in the user gesture so iOS Safari allows custom schemes.
  window.location.href = url

  return cleanup
}
