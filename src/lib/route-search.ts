import type {QrKind, SocialPlatform} from './payloads'

export interface GenSearch {
  bank?: string
  acc?: string
  name?: string
  amount?: string
  memo?: string
  account?: string
  card?: boolean
  payload?: string
  /** Keep an exported history snapshot selected until the code is edited. */
  h?: string
}

export interface LinkSearch {
  bank?: string
  acc?: string
  name?: string
  amount?: string
  memo?: string
  note?: string
  card?: boolean
  exp?: string
  preview?: boolean
}

export interface QrSearch {
  type?: QrKind
  url?: string
  text?: string
  ssid?: string
  password?: string
  security?: 'WPA' | 'WEP' | 'nopass'
  hidden?: boolean
  firstName?: string
  lastName?: string
  org?: string
  title?: string
  mobile?: string
  phone?: string
  email?: string
  website?: string
  address?: string
  note?: string
  to?: string
  subject?: string
  body?: string
  message?: string
  lat?: string
  lng?: string
  label?: string
  location?: string
  start?: string
  end?: string
  allDay?: boolean
  timeZone?: string
  description?: string
  platform?: SocialPlatform
  handle?: string
  caption?: string
}

export interface ScanSearch {
  text?: string
  url?: string
  title?: string
  shareId?: string
  shareError?: boolean
}

export type DeepLinkIntent = 'auto' | 'create' | 'scan'

export interface OpenSearch extends ScanSearch {
  q?: string
  payload?: string
  phone?: string
  intent?: DeepLinkIntent
  source?: string
}

export type ToolId = 'inspect' | 'words' | 'split' | 'clean' | 'crc'

export interface ToolsSearch {
  tool?: ToolId
  input?: string
  amount?: string
  total?: string
  people?: number
  tip?: number
}

export type AppFilter = 'all' | 'deeplink' | 'autofill'

export interface BanksSearch {
  q?: string
  filter?: AppFilter
  napas?: boolean
}

export interface RouteSearchMap {
  '/': GenSearch
  '/qr': QrSearch
  '/scan': ScanSearch
  '/open': OpenSearch
  '/link': LinkSearch
  '/tools': ToolsSearch
  '/banks': BanksSearch
  // /pay validates the combined fragment and query in decodePayLink.
  '/pay': Record<string, string>
  '/accounts': Record<string, string>
  '/history': Record<string, string>
  '/settings': Record<string, string>
  '/about': Record<string, string>
}

export type DeepLinkTargetRoute = keyof RouteSearchMap
export type DeepLinkDestination = {
  [Path in DeepLinkTargetRoute]: {to: Path; search: RouteSearchMap[Path]; hash?: string}
}[DeepLinkTargetRoute]

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined)
const bool = (v: unknown) =>
  v === true || v === 'true' || v === '1'
    ? true
    : v === false || v === 'false' || v === '0'
      ? false
      : undefined
const num = (v: unknown) => {
  const n = Number(v)
  return v !== '' && v !== undefined && v !== null && Number.isFinite(n) ? n : undefined
}
const oneOf = <T extends string>(v: unknown, values: readonly T[]) =>
  values.find((item) => item === v)
const withHash = (s: object, hash: string): Record<string, unknown> => ({
  ...s,
  ...Object.fromEntries(new URLSearchParams(hash.replace(/^#/, ''))),
})

/** Router hashes are decoded for anchors; payloads need the original percent escapes. */
export function rawLocationHash(location: {href: string}): string {
  const index = location.href.indexOf('#')
  return index < 0 ? '' : location.href.slice(index + 1)
}

export function encodeRouteSearch(search: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  return params.toString()
}

export function parseGenSearch(input: object, hash = ''): GenSearch {
  const s = withHash(input, hash)
  return {
    bank: str(s.bank),
    acc: str(s.acc),
    name: str(s.name),
    amount: str(s.amount),
    memo: str(s.memo),
    account: str(s.account),
    card: bool(s.card),
    payload: str(s.payload) ?? str(s.vietqr),
    h: str(s.h),
  }
}

export function parseLinkSearch(input: object, hash = ''): LinkSearch {
  const s = withHash(input, hash)
  const {bank, acc, name, amount, memo, card} = parseGenSearch(s)
  return {
    bank,
    acc,
    name,
    amount,
    memo,
    card,
    note: str(s.note),
    exp: str(s.exp),
    preview: bool(s.preview),
  }
}

export function parseQrSearch(input: object, hash = ''): QrSearch {
  const s = withHash(input, hash)
  return {
    type: oneOf<QrKind>(s.type, [
      'url',
      'text',
      'wifi',
      'vcard',
      'email',
      'sms',
      'phone',
      'geo',
      'event',
      'social',
    ]),
    url: str(s.url),
    text: str(s.text),
    ssid: str(s.ssid),
    password: str(s.password),
    security: oneOf(s.security, ['WPA', 'WEP', 'nopass']),
    hidden: bool(s.hidden),
    firstName: str(s.firstName),
    lastName: str(s.lastName),
    org: str(s.org),
    title: str(s.title),
    mobile: str(s.mobile),
    phone: str(s.phone),
    email: str(s.email),
    website: str(s.website),
    address: str(s.address),
    note: str(s.note),
    to: str(s.to),
    subject: str(s.subject),
    body: str(s.body),
    message: str(s.message),
    lat: str(s.lat),
    lng: str(s.lng),
    label: str(s.label),
    location: str(s.location),
    start: str(s.start),
    end: str(s.end),
    allDay: bool(s.allDay),
    timeZone: str(s.timeZone),
    description: str(s.description),
    platform: oneOf<SocialPlatform>(s.platform, [
      'zalo',
      'facebook',
      'messenger',
      'tiktok',
      'instagram',
      'youtube',
      'telegram',
      'x',
      'shopee',
    ]),
    handle: str(s.handle),
    caption: str(s.caption),
  }
}

export function parseScanSearch(input: object, hash = ''): ScanSearch {
  const s = withHash(input, hash)
  return {
    text: str(s.text),
    url: str(s.url),
    title: str(s.title),
    shareId: str(s.shareId),
    shareError: bool(s.shareError),
  }
}

export function parseOpenSearch(input: object, hash = ''): OpenSearch {
  const s = withHash(input, hash)
  const nonEmpty = (v: unknown) => str(v)?.trim() || undefined
  return {
    ...parseScanSearch(s),
    url: nonEmpty(s.url),
    text: nonEmpty(s.text),
    q: nonEmpty(s.q),
    payload: nonEmpty(s.payload),
    phone: nonEmpty(s.phone),
    intent: oneOf(s.intent, ['auto', 'create', 'scan']),
    source: nonEmpty(s.source),
  }
}

export function openPayload(search: OpenSearch): string | undefined {
  return [search.q, search.url, search.payload, search.phone, search.text]
    .find((v) => v?.trim())
    ?.trim()
}

export function parseToolsSearch(input: object, hash = ''): ToolsSearch {
  const s = withHash(input, hash)
  return {
    tool: oneOf<ToolId>(s.tool, ['inspect', 'words', 'split', 'clean', 'crc']),
    input: str(s.input),
    amount: str(s.amount),
    total: str(s.total),
    people: num(s.people),
    tip: num(s.tip),
  }
}

export function parseBanksSearch(input: object, hash = ''): BanksSearch {
  const s = withHash(input, hash)
  return {
    q: str(s.q),
    filter: oneOf<AppFilter>(s.filter, ['all', 'deeplink', 'autofill']),
    napas: bool(s.napas),
  }
}

export function parseRouteDestination(
  to: DeepLinkTargetRoute,
  params: URLSearchParams,
  hash = '',
): DeepLinkDestination {
  const search = Object.fromEntries(params)
  const anchor = hash && !hash.includes('=') ? hash.replace(/^#/, '') : undefined
  switch (to) {
    case '/':
      return {to, search: parseGenSearch(search, hash), hash: anchor}
    case '/qr':
      return {to, search: parseQrSearch(search, hash), hash: anchor}
    case '/scan':
      return {to, search: parseScanSearch(search, hash), hash: anchor}
    case '/open':
      return {to, search: parseOpenSearch(search, hash), hash: anchor}
    case '/link':
      return {to, search: parseLinkSearch(search, hash), hash: anchor}
    case '/tools':
      return {to, search: parseToolsSearch(search, hash), hash: anchor}
    case '/banks':
      return {to, search: parseBanksSearch(search, hash), hash: anchor}
    default:
      return {to, search, hash: hash.replace(/^#/, '') || undefined}
  }
}

export function privateDestination(destination: DeepLinkDestination): DeepLinkDestination {
  if (destination.to === '/pay' || (destination.hash && !destination.hash.includes('=')))
    return destination
  return {...destination, search: {}, hash: encodeRouteSearch(destination.search) || undefined}
}
