/** Builders and a classifier for general-purpose QR payloads (Wi-Fi, vCard, …). */
import {looksLikeEmv, parseEmvQr, type EmvParseResult} from './vietqr.ts'

export type QrKind = 'url' | 'text' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo' | 'event' | 'social'

export interface WifiData {
  ssid: string
  password: string
  security: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}
export interface VCardData {
  firstName: string
  lastName: string
  org: string
  title: string
  phone: string
  mobile: string
  email: string
  website: string
  address: string
  note: string
}
export interface EmailData {
  to: string
  subject: string
  body: string
}
export interface SmsData {
  phone: string
  message: string
}
export interface GeoData {
  lat: string
  lng: string
  label: string
}
export interface EventData {
  title: string
  location: string
  start: string // datetime-local value
  end: string
  allDay: boolean
  description: string
}
export type SocialPlatform = 'zalo' | 'facebook' | 'messenger' | 'tiktok' | 'instagram' | 'youtube' | 'telegram' | 'x' | 'shopee'
export interface SocialData {
  platform: SocialPlatform
  handle: string
}

/** Escape ; , : \ " for WIFI: and MECARD-style fields. */
function escWifi(v: string): string {
  return v.replace(/([\\;,:"])/g, '\\$1')
}

export function buildWifi(d: WifiData): string {
  const parts = [`T:${d.security}`, `S:${escWifi(d.ssid)}`]
  if (d.security !== 'nopass') parts.push(`P:${escWifi(d.password)}`)
  if (d.hidden) parts.push('H:true')
  return `WIFI:${parts.join(';')};;`
}

function escV(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

export function buildVCard(d: VCardData): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  lines.push(`N:${escV(d.lastName)};${escV(d.firstName)};;;`)
  lines.push(`FN:${escV([d.firstName, d.lastName].filter(Boolean).join(' ') || d.org)}`)
  if (d.org) lines.push(`ORG:${escV(d.org)}`)
  if (d.title) lines.push(`TITLE:${escV(d.title)}`)
  if (d.mobile) lines.push(`TEL;TYPE=CELL:${d.mobile}`)
  if (d.phone) lines.push(`TEL;TYPE=WORK,VOICE:${d.phone}`)
  if (d.email) lines.push(`EMAIL:${d.email}`)
  if (d.website) lines.push(`URL:${d.website}`)
  if (d.address) lines.push(`ADR;TYPE=WORK:;;${escV(d.address)};;;;`)
  if (d.note) lines.push(`NOTE:${escV(d.note)}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

export function buildEmail(d: EmailData): string {
  const q = new URLSearchParams()
  if (d.subject) q.set('subject', d.subject)
  if (d.body) q.set('body', d.body)
  const qs = q.toString().replace(/\+/g, '%20')
  return `mailto:${d.to}${qs ? `?${qs}` : ''}`
}

export function buildSms(d: SmsData): string {
  return `SMSTO:${normalizePhone(d.phone)}:${d.message}`
}

export function buildPhone(phone: string): string {
  return `tel:${normalizePhone(phone)}`
}

export function buildGeo(d: GeoData): string {
  const lat = Number(d.lat)
  const lng = Number(d.lng)
  const base = `geo:${Number.isFinite(lat) ? lat : 0},${Number.isFinite(lng) ? lng : 0}`
  return d.label ? `${base}?q=${encodeURIComponent(`${lat},${lng}(${d.label})`)}` : base
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2026-12-24" or "2026-12-24T19:00" → calendar date parts, read as a local date (no UTC shift). */
function dateParts(value: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** All-day value; `plusDays` makes DTEND exclusive as RFC 5545 requires. */
function icsDay(value: string, plusDays = 0): string {
  const p = dateParts(value)
  if (!p) return ''
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + plusDays))
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

function icsDateTime(value: string): string {
  if (!value) return ''
  const d = new Date(value) // datetime-local strings are local time
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`
}

export function buildEvent(d: EventData): string {
  const lines = ['BEGIN:VEVENT', `SUMMARY:${escV(d.title)}`]
  const start = d.allDay ? icsDay(d.start) : icsDateTime(d.start)
  const end = d.allDay ? icsDay(d.end || d.start, 1) : icsDateTime(d.end || d.start)
  if (start) lines.push(d.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`)
  if (end) lines.push(d.allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`)
  if (d.location) lines.push(`LOCATION:${escV(d.location)}`)
  if (d.description) lines.push(`DESCRIPTION:${escV(d.description)}`)
  lines.push('END:VEVENT')
  return lines.join('\n')
}

export const SOCIAL_PREFIX: Record<SocialPlatform, string> = {
  zalo: 'https://zalo.me/',
  facebook: 'https://facebook.com/',
  messenger: 'https://m.me/',
  tiktok: 'https://www.tiktok.com/@',
  instagram: 'https://instagram.com/',
  youtube: 'https://youtube.com/@',
  telegram: 'https://t.me/',
  x: 'https://x.com/',
  shopee: 'https://shopee.vn/',
}

export function buildSocial(d: SocialData): string {
  let handle = d.handle.trim().replace(/^@/, '')
  if (/^https?:\/\//i.test(handle)) return handle
  if (d.platform === 'zalo') {
    const digits = handle.replace(/[^\d]/g, '')
    handle = digits.startsWith('0') ? `84${digits.slice(1)}` : digits || handle
  }
  return SOCIAL_PREFIX[d.platform] + handle
}

export function normalizeUrl(input: string): string {
  const v = input.trim()
  if (!v) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v
  return `https://${v}`
}

/** Vietnamese numbers: 0912… → +84912… for tel/SMS links. */
export function normalizePhone(input: string): string {
  const v = input.replace(/[^\d+]/g, '')
  if (v.startsWith('+')) return v
  if (v.startsWith('84') && v.length >= 11) return `+${v}`
  if (v.startsWith('0') && v.length >= 9) return `+84${v.slice(1)}`
  return v
}

// ---------------------------------------------------------------------------
// Classifier for scanned content
// ---------------------------------------------------------------------------

export type Classified =
  | {type: 'emv'; emv: EmvParseResult}
  | {type: 'emv-invalid'; error: string}
  | {type: 'url'; url: string}
  | {type: 'wifi'; wifi: WifiData}
  | {type: 'vcard'; fields: Array<[string, string]>; name: string}
  | {type: 'email'; to: string; subject: string; body: string}
  | {type: 'phone'; phone: string}
  | {type: 'sms'; phone: string; message: string}
  | {type: 'geo'; lat: string; lng: string; query: string}
  | {type: 'event'; fields: Array<[string, string]>; title: string}
  | {type: 'text'; text: string}

function unescWifi(v: string) {
  return v.replace(/\\([\\;,:"])/g, '$1')
}

function parseWifi(text: string): WifiData | null {
  if (!/^WIFI:/i.test(text)) return null
  const body = text.slice(5)
  const map: Record<string, string> = {}
  const re = /([A-Z]):((?:\\.|[^;])*);/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) map[m[1].toUpperCase()] = unescWifi(m[2])
  const t = (map.T ?? 'nopass').toUpperCase()
  return {
    ssid: map.S ?? '',
    password: map.P ?? '',
    security: t === 'WEP' ? 'WEP' : t === 'WPA' || t === 'WPA2' || t === 'WPA3' || t === 'SAE' ? 'WPA' : 'nopass',
    hidden: (map.H ?? '').toLowerCase() === 'true',
  }
}

const VCARD_LABELS: Record<string, string> = {
  FN: 'name',
  N: 'name',
  ORG: 'org',
  TITLE: 'title',
  TEL: 'phone',
  EMAIL: 'email',
  URL: 'website',
  ADR: 'address',
  NOTE: 'note',
}

function parseVCard(text: string): {fields: Array<[string, string]>; name: string} {
  const fields: Array<[string, string]> = []
  let name = ''
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).split(';')[0].toUpperCase()
    const value = line
      .slice(idx + 1)
      .replace(/\\n/g, '\n')
      .replace(/\\([,;\\])/g, '$1')
      .replace(/;+/g, ' ')
      .trim()
    if (!value || key === 'BEGIN' || key === 'END' || key === 'VERSION') continue
    if (key === 'FN') name = value
    if (key === 'N' && !name) name = value
    const label = VCARD_LABELS[key]
    if (label && !(key === 'N' && fields.some(([l]) => l === 'name'))) fields.push([label, value])
  }
  return {fields, name}
}

function parseMeCard(text: string): {fields: Array<[string, string]>; name: string} {
  const body = text.slice(7)
  const fields: Array<[string, string]> = []
  let name = ''
  const map: Record<string, string> = {N: 'name', TEL: 'phone', EMAIL: 'email', URL: 'website', ADR: 'address', NOTE: 'note', ORG: 'org'}
  const re = /([A-Z-]+):((?:\\.|[^;])*);/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const key = m[1].toUpperCase()
    const value = unescWifi(m[2]).replace(/,/g, ' ').trim()
    if (key === 'N') name = value
    if (map[key] && value) fields.push([map[key], value])
  }
  return {fields, name}
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

function safeParams(query: string): URLSearchParams {
  try {
    return new URLSearchParams(query)
  } catch {
    return new URLSearchParams()
  }
}

/** Never throws: anything unparseable is reported as plain text. */
export function classifyPayload(raw: string): Classified {
  try {
    return classifyUnsafe(raw)
  } catch {
    return {type: 'text', text: raw.trim()}
  }
}

/** Contact fields from a scanned vCard/MECARD → a proper vCard 3.0 for download. */
export function contactToVCard(fields: Array<[string, string]>, name: string): string {
  const get = (k: string) => fields.find(([key]) => key === k)?.[1] ?? ''
  const [last = '', ...first] = name.split(/[ ,]+/).filter(Boolean)
  return buildVCard({
    firstName: first.join(' '),
    lastName: last,
    org: get('org'),
    title: get('title'),
    phone: '',
    mobile: get('phone'),
    email: get('email'),
    website: get('website'),
    address: get('address'),
    note: get('note'),
  })
}

function classifyUnsafe(raw: string): Classified {
  const text = raw.trim()
  if (looksLikeEmv(text)) {
    try {
      return {type: 'emv', emv: parseEmvQr(text)}
    } catch (e) {
      return {type: 'emv-invalid', error: (e as Error).message}
    }
  }
  const wifi = parseWifi(text)
  if (wifi) return {type: 'wifi', wifi}
  if (/^BEGIN:VCARD/i.test(text)) return {type: 'vcard', ...parseVCard(text)}
  if (/^MECARD:/i.test(text)) return {type: 'vcard', ...parseMeCard(text)}
  if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(text)) {
    const {fields} = parseVCard(text)
    const summary = /SUMMARY:(.*)/i.exec(text)?.[1]?.trim() ?? ''
    const extra: Array<[string, string]> = []
    const start = /DTSTART[^:]*:(\S+)/i.exec(text)?.[1]
    const end = /DTEND[^:]*:(\S+)/i.exec(text)?.[1]
    const loc = /LOCATION:(.*)/i.exec(text)?.[1]
    if (start) extra.push(['start', formatIcs(start)])
    if (end) extra.push(['end', formatIcs(end)])
    if (loc) extra.push(['location', loc.trim()])
    return {type: 'event', fields: [...extra, ...fields.filter(([k]) => k === 'note')], title: summary}
  }
  if (/^mailto:/i.test(text)) {
    const [address, query = ''] = text.slice(7).split('?')
    const q = safeParams(query)
    return {type: 'email', to: safeDecode(address), subject: q.get('subject') ?? '', body: q.get('body') ?? ''}
  }
  if (/^MATMSG:/i.test(text)) {
    const to = /TO:([^;]*)/i.exec(text)?.[1] ?? ''
    return {type: 'email', to, subject: /SUB:([^;]*)/i.exec(text)?.[1] ?? '', body: /BODY:([^;]*)/i.exec(text)?.[1] ?? ''}
  }
  if (/^tel:/i.test(text)) return {type: 'phone', phone: text.slice(4)}
  // RFC 5724 URI ("sms:+849…?body=Hi") — checked before the colon form it would otherwise match.
  if (/^sms:[^:]*$/i.test(text)) {
    const [phone, query = ''] = text.slice(4).split('?')
    return {type: 'sms', phone: safeDecode(phone), message: safeParams(query).get('body') ?? ''}
  }
  if (/^(SMSTO|SMS):/i.test(text)) {
    const [, phone = '', ...rest] = text.split(':')
    return {type: 'sms', phone, message: rest.join(':')}
  }
  if (/^geo:/i.test(text)) {
    const [coords, query = ''] = text.slice(4).split('?')
    const [lat = '', lng = ''] = coords.split(',')
    return {type: 'geo', lat, lng, query: new URLSearchParams(query).get('q') ?? ''}
  }
  if (/^(https?:\/\/|www\.)\S+$/i.test(text)) return {type: 'url', url: normalizeUrl(text)}
  return {type: 'text', text}
}

function formatIcs(v: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v)
  if (!m) return v
  const [, y, mo, d, h, mi] = m
  return h ? `${d}/${mo}/${y} ${h}:${mi}${v.endsWith('Z') ? ' UTC' : ''}` : `${d}/${mo}/${y}`
}
