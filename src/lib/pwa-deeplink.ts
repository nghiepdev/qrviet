/**
 * PWA Deep Link classifier & router.
 *
 * Resolves custom protocol URIs (`web+qrviet://`, `web+vietqr://`), in-scope
 * HTTPS URLs, VietQR image URLs (`img.vietqr.io`), and copied/shared raw text
 * (QR payloads, URLs, phone numbers, emails, Wi-Fi, vCard, coordinates) into
 * an app route + pre-filled query parameters.
 */
import {getBankByBin, resolveBank} from '#/data/banks'
import {formatVnd} from '#/lib/money'
import {classifyPayload, normalizePhone, normalizeUrl, type Classified} from './payloads'
import {qrSearchFromClassified} from './qr-prefill'
import {
  openPayload,
  parseOpenSearch,
  parseRouteDestination,
  privateDestination,
  type DeepLinkDestination,
  type DeepLinkIntent,
  type DeepLinkTargetRoute,
  type GenSearch,
  type OpenSearch,
} from './route-search'
import type {MessageKey} from '#/i18n'

export type {DeepLinkIntent, DeepLinkTargetRoute} from './route-search'

export type DeepLinkCategory =
  | 'pay'
  | 'vietqr'
  | 'vietqr-url'
  | 'url'
  | 'social'
  | 'phone'
  | 'sms'
  | 'email'
  | 'wifi'
  | 'vcard'
  | 'geo'
  | 'event'
  | 'text'
  | 'route'

type Description = {category: DeepLinkCategory; labelKey: MessageKey; summary: string}
export type ResolvedDeepLink = DeepLinkDestination &
  Description & {
    alternate?: DeepLinkDestination & {labelKey: MessageKey}
  }

const KNOWN_APP_ORIGINS = new Set(['https://qrviet.nghiep.dev', 'https://qrviet.app'])

const ROUTE_ALIASES: Record<string, DeepLinkTargetRoute> = {
  '': '/',
  '/': '/',
  create: '/',
  '/create': '/',
  vietqr: '/',
  '/vietqr': '/',
  scan: '/scan',
  '/scan': '/scan',
  qr: '/qr',
  '/qr': '/qr',
  link: '/link',
  '/link': '/link',
  pay: '/pay',
  '/pay': '/pay',
  tools: '/tools',
  '/tools': '/tools',
  banks: '/banks',
  '/banks': '/banks',
  accounts: '/accounts',
  '/accounts': '/accounts',
  history: '/history',
  '/history': '/history',
  settings: '/settings',
  '/settings': '/settings',
  about: '/about',
  '/about': '/about',
  open: '/open',
  '/open': '/open',
}

function stripBasePath(pathname: string): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')
  if (base && base !== '/' && (pathname === base || pathname.startsWith(`${base}/`))) {
    const rest = pathname.slice(base.length)
    return rest || '/'
  }
  return pathname
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

/** Strict phone detector so bank account numbers (e.g. `0071000888999`) are not misclassified. */
function detectBarePhone(text: string): string | null {
  if (/^tel:/i.test(text)) return text.slice(4).trim() || null
  if (/[a-zA-Z/@]/.test(text)) return null
  const trimmed = text.trim()
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/[^\d]/g, '')
    if (digits.length >= 9 && digits.length <= 15 && /^\+[\d\s().-]+$/.test(trimmed)) {
      return `+${digits}`
    }
    return null
  }
  // Vietnamese mobile/landline patterns starting with 02/03/05/07/08/09
  if (/^0(?:2\d|3\d|5\d|7\d|8\d|9\d)[\d\s().-]{7,12}$/.test(trimmed)) {
    const digits = trimmed.replace(/[^\d]/g, '')
    if (digits.length === 10 || digits.length === 11) return normalizePhone(digits)
  }
  return null
}

function detectBareEmail(text: string): string | null {
  const trimmed = text.trim()
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(trimmed)) return trimmed
  return null
}

function detectBareCoords(text: string): {lat: string; lng: string} | null {
  const m = /^(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})$/.exec(text.trim())
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return {lat: m[1], lng: m[2]}
  }
  return null
}

function detectBareDomain(text: string): string | null {
  const trimmed = text.trim()
  if (/\s/.test(trimmed)) return null
  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(trimmed)) {
    return normalizeUrl(trimmed)
  }
  return null
}

function detectMapsCoords(urlStr: string): {lat: string; lng: string; label?: string} | null {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./i, '').toLowerCase()
  if (
    !/^(?:maps\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host) &&
    host !== 'maps.apple.com'
  )
    return null
  const atMatch = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u.pathname + u.search)
  if (atMatch) return {lat: atMatch[1], lng: atMatch[2]}
  const q = u.searchParams.get('q') ?? u.searchParams.get('ll') ?? ''
  const qMatch = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(q)
  if (qMatch) return {lat: qMatch[1], lng: qMatch[2]}
  return null
}

/** Parse `https://img.vietqr.io/image/<BANK>-<ACC>-<TPL>.<ext>?amount=...&addInfo=...&accountName=...`. */
function parseVietQrImageUrl(urlStr: string): (GenSearch & {bank: string; acc: string}) | null {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }
  if (!/^(?:img|api)\.vietqr\.io$/i.test(u.hostname)) return null
  const m = /^\/image\/([^-/]+)-([^-/]+)/i.exec(u.pathname)
  if (!m) return null
  const bank = resolveBank(safeDecode(m[1]))
  const acc = safeDecode(m[2]).replace(/[^0-9A-Za-z]/g, '')
  if (!bank || !acc) return null
  const amount = u.searchParams.get('amount') ?? undefined
  const memo = u.searchParams.get('addInfo') ?? u.searchParams.get('memo') ?? undefined
  const name = u.searchParams.get('accountName') ?? u.searchParams.get('name') ?? undefined
  return {
    bank: bank.bin,
    acc,
    ...(amount ? {amount} : {}),
    ...(memo ? {memo} : {}),
    ...(name ? {name} : {}),
  }
}

function isOwnAppUrl(url: URL): boolean {
  const origins = [...KNOWN_APP_ORIGINS]
  if (typeof location !== 'undefined' && location.origin !== 'null') origins.push(location.origin)
  const Origin = (
    globalThis as {
      Origin?: {from(value: string): {isSameOrigin(other: unknown): boolean}}
    }
  ).Origin
  if (Origin) {
    const candidate = Origin.from(url.href)
    return origins.some((origin) => candidate.isSameOrigin(Origin.from(origin)))
  }
  return url.origin !== 'null' && origins.includes(url.origin)
}

function resolveAppUrl(
  url: URL,
  intent: DeepLinkIntent,
  depth: number,
  protocol = false,
): ResolvedDeepLink | null {
  const path = stripBasePath(url.pathname)
  const route = Object.hasOwn(ROUTE_ALIASES, path) ? ROUTE_ALIASES[path] : undefined
  if (!route || (!protocol && !url.search && !url.hash)) return null
  if (route === '/open') {
    const search = parseOpenSearch(Object.fromEntries(url.searchParams), url.hash)
    const raw = openPayload(search)
    if (raw) return resolveDeepLink(raw, search.intent ?? intent, depth + 1)
  }
  const destination = privateDestination(parseRouteDestination(route, url.searchParams, url.hash))
  return {
    ...destination,
    category: route === '/pay' ? 'pay' : 'route',
    labelKey: route === '/pay' ? 'deeplink.cat.pay' : 'deeplink.cat.route',
    summary: `${route}${url.search}`,
  }
}

function resolveCustomProtocol(
  raw: string,
  intent: DeepLinkIntent,
  depth: number,
): ResolvedDeepLink | null {
  const match = /^web\+(?:qrviet|vietqr):(?:\/\/)?([\s\S]+)$/i.exec(raw)
  if (!match) return null
  const rest = match[1].trim()
  if (!rest) return null
  if (
    /^(?:000201|https?:\/\/|WIFI:|tel:|mailto:|MATMSG:|SMSTO:|SMS:|geo:|BEGIN:|MECARD:)/i.test(rest)
  ) {
    return resolveDeepLink(rest, intent, depth + 1)
  }
  try {
    const url = new URL(`https://qrviet.local/${rest.replace(/^\/+/, '')}`)
    const resolved = resolveAppUrl(url, intent, depth, true)
    if (resolved) return resolved
  } catch {
    // A protocol can carry a raw encoded payload instead of an app route.
  }
  return resolveDeepLink(safeDecode(rest), intent, depth + 1)
}

function smartClassify(raw: string): Classified {
  const classified = classifyPayload(raw)
  if (classified.type !== 'text') return classified
  const phone = detectBarePhone(raw)
  if (phone) return {type: 'phone', phone}
  const email = detectBareEmail(raw)
  if (email) return {type: 'email', to: email, subject: '', body: ''}
  const coords = detectBareCoords(raw)
  if (coords) return {type: 'geo', ...coords, query: ''}
  const domain = detectBareDomain(raw)
  return domain ? {type: 'url', url: domain} : classified
}

function describe(classified: Classified, raw: string): Description {
  switch (classified.type) {
    case 'emv': {
      const payload = classified.emv
      if (payload.kind !== 'vietqr')
        return {category: 'vietqr', labelKey: 'deeplink.cat.emv', summary: raw.slice(0, 40)}
      return {
        category: 'vietqr',
        labelKey: 'deeplink.cat.vietqr',
        summary: [
          getBankByBin(payload.bin)?.shortName ?? payload.bin,
          payload.accountNumber,
          payload.amount ? formatVnd(payload.amount, true) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }
    }
    case 'emv-invalid':
      return {category: 'vietqr', labelKey: 'deeplink.cat.emv', summary: raw.slice(0, 40)}
    case 'url':
      return {category: 'url', labelKey: 'deeplink.cat.url', summary: classified.url}
    case 'phone':
      return {
        category: 'phone',
        labelKey: 'deeplink.cat.phone',
        summary: normalizePhone(classified.phone),
      }
    case 'sms':
      return {
        category: 'sms',
        labelKey: 'deeplink.cat.sms',
        summary: normalizePhone(classified.phone),
      }
    case 'email':
      return {category: 'email', labelKey: 'deeplink.cat.email', summary: classified.to}
    case 'wifi':
      return {category: 'wifi', labelKey: 'deeplink.cat.wifi', summary: classified.wifi.ssid}
    case 'vcard':
      return {
        category: 'vcard',
        labelKey: 'deeplink.cat.vcard',
        summary: classified.name || raw.slice(0, 40),
      }
    case 'geo':
      return {
        category: 'geo',
        labelKey: 'deeplink.cat.geo',
        summary: `${classified.lat}, ${classified.lng}`,
      }
    case 'event':
      return {
        category: 'event',
        labelKey: 'deeplink.cat.event',
        summary: classified.title || raw.slice(0, 40),
      }
    case 'text':
      return {category: 'text', labelKey: 'deeplink.cat.text', summary: raw.slice(0, 60)}
  }
}

export function resolveOpenDestination(search: OpenSearch): DeepLinkDestination {
  if (search.shareId || search.shareError) {
    return privateDestination({
      to: '/scan',
      search: {
        text: search.text,
        url: search.url,
        title: search.title,
        shareId: search.shareId,
        shareError: search.shareError,
      },
    })
  }
  const raw = openPayload(search)
  if (!raw) return {to: '/', search: {}}
  return (
    resolvePwaDeepLink(raw, {intent: search.intent}) ??
    privateDestination({to: '/scan', search: {text: raw}})
  )
}

export function resolvePwaDeepLink(
  raw: string,
  opts: {intent?: DeepLinkIntent} = {},
): ResolvedDeepLink | null {
  return resolveDeepLink(raw, opts.intent ?? 'auto', 0)
}

function resolveDeepLink(
  rawInput: string,
  intent: DeepLinkIntent,
  depth: number,
): ResolvedDeepLink | null {
  const raw = rawInput.trim()
  if (!raw || depth >= 8) return null
  const protocol = resolveCustomProtocol(raw, intent, depth)
  if (protocol) return protocol
  if (/^web\+(?:qrviet|vietqr):/i.test(raw)) return null

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (isOwnAppUrl(url)) {
        const app = resolveAppUrl(url, intent, depth)
        if (app) return app
      }
      const image = parseVietQrImageUrl(raw)
      if (image) {
        const create = privateDestination({to: '/', search: image})
        return {
          ...(intent === 'scan' ? privateDestination({to: '/scan', search: {text: raw}}) : create),
          category: 'vietqr-url',
          labelKey: 'deeplink.cat.vietqr',
          summary: [getBankByBin(image.bank)?.shortName ?? image.bank, image.acc, image.amount]
            .filter(Boolean)
            .join(' · '),
          alternate:
            intent === 'scan'
              ? {...create, labelKey: 'deeplink.alt.createVietqr'}
              : {
                  ...privateDestination({to: '/link', search: image}),
                  labelKey: 'deeplink.alt.paymentLink',
                },
        }
      }
    } catch {
      // Invalid URLs still go through the safe payload classifier.
    }
  }

  const classified = smartClassify(raw)
  const description = describe(classified, raw)
  const scan = privateDestination({to: '/scan', search: {text: raw}})
  if (classified.type === 'emv' && classified.emv.kind === 'vietqr') {
    const create = privateDestination({to: '/', search: {payload: raw}})
    return intent === 'create'
      ? {...create, ...description, alternate: {...scan, labelKey: 'deeplink.alt.scanPay'}}
      : {...scan, ...description, alternate: {...create, labelKey: 'deeplink.alt.createVietqr'}}
  }
  if (classified.type === 'emv' || classified.type === 'emv-invalid') {
    const inspect = privateDestination({to: '/tools', search: {tool: 'inspect', input: raw}})
    return intent === 'scan'
      ? {...scan, ...description, alternate: {...inspect, labelKey: 'deeplink.cat.emv'}}
      : {...inspect, ...description, alternate: {...scan, labelKey: 'deeplink.alt.scanPay'}}
  }
  const qr = qrSearchFromClassified(classified)
  if (!qr || (classified.type === 'text' && raw.length > 900)) return {...scan, ...description}
  if (intent === 'scan') {
    return {
      ...scan,
      ...description,
      alternate: {
        ...privateDestination({to: '/qr', search: qr}),
        labelKey: 'deeplink.alt.createQr',
      },
    }
  }
  if (classified.type === 'url') {
    const maps = detectMapsCoords(classified.url)
    if (maps) {
      return {
        ...privateDestination({to: '/qr', search: {type: 'geo', lat: maps.lat, lng: maps.lng}}),
        category: 'geo',
        labelKey: 'deeplink.cat.geo',
        summary: `${maps.lat}, ${maps.lng}`,
        alternate: {
          ...privateDestination({to: '/qr', search: {type: 'url', url: classified.url}}),
          labelKey: 'deeplink.alt.asUrl',
        },
      }
    }
    if (qr.type === 'social') {
      return {
        ...privateDestination({to: '/qr', search: qr}),
        category: 'social',
        labelKey: 'deeplink.cat.social',
        summary: `${qr.platform} · ${qr.handle}`,
        alternate: {
          ...privateDestination({to: '/qr', search: {type: 'url', url: classified.url}}),
          labelKey: 'deeplink.alt.asUrl',
        },
      }
    }
  }
  const create = privateDestination({to: '/qr', search: qr})
  const alternate =
    classified.type === 'phone' && !/^tel:/i.test(raw)
      ? {
          ...privateDestination({
            to: '/qr',
            search: {type: 'sms', phone: normalizePhone(classified.phone)},
          }),
          labelKey: 'deeplink.alt.asSms' as const,
        }
      : {...scan, labelKey: 'deeplink.alt.inspectScan' as const}
  return {...create, ...description, alternate}
}
