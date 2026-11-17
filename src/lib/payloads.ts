/** Builders and a classifier for general-purpose QR payloads (Wi-Fi, vCard, …). */
import {looksLikeEmv, parseEmvQr, type EmvParseResult} from './vietqr.ts'

const Temporal =
  (globalThis as {Temporal?: typeof import('temporal-polyfill').Temporal}).Temporal ??
  (await import('temporal-polyfill')).Temporal

export type QrKind =
  | 'url'
  | 'text'
  | 'wifi'
  | 'vcard'
  | 'email'
  | 'sms'
  | 'phone'
  | 'geo'
  | 'event'
  | 'social'

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
  timeZone?: string
  description: string
}
export type SocialPlatform =
  | 'zalo'
  | 'facebook'
  | 'messenger'
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'telegram'
  | 'x'
  | 'shopee'
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
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1')
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

/** DTEND is exclusive for all-day events. */
function icsDay(value: string, plusDays = 0): string {
  if (!value) return ''
  try {
    return Temporal.PlainDate.from(value.slice(0, 10))
      .add({days: plusDays})
      .toString()
      .replace(/-/g, '')
  } catch {
    return ''
  }
}

function icsDateTime(value: string, timeZone?: string): string {
  if (!value) return ''
  try {
    const utc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
      ? Temporal.Instant.from(value).toZonedDateTimeISO('UTC')
      : Temporal.PlainDateTime.from(value)
          .toZonedDateTime(timeZone || Temporal.Now.timeZoneId(), {disambiguation: 'compatible'})
          .withTimeZone('UTC')
    return `${utc.toPlainDateTime().toString({smallestUnit: 'second'}).replace(/[-:]/g, '')}Z`
  } catch {
    return ''
  }
}

export function buildEvent(d: EventData): string {
  const lines = ['BEGIN:VEVENT', `SUMMARY:${escV(d.title)}`]
  const start = d.allDay ? icsDay(d.start) : icsDateTime(d.start, d.timeZone)
  const end = d.allDay ? icsDay(d.end || d.start, 1) : icsDateTime(d.end || d.start, d.timeZone)
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
  | {type: 'vcard'; fields: Array<[string, string]>; name: string; vcard: VCardData}
  | {type: 'email'; to: string; subject: string; body: string}
  | {type: 'phone'; phone: string}
  | {type: 'sms'; phone: string; message: string}
  | {type: 'geo'; lat: string; lng: string; query: string}
  | {type: 'event'; fields: Array<[string, string]>; title: string; event: EventData | null}
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
    security:
      t === 'WEP'
        ? 'WEP'
        : t === 'WPA' || t === 'WPA2' || t === 'WPA3' || t === 'SAE'
          ? 'WPA'
          : 'nopass',
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

function unescText(value: string): string {
  return value.replace(/\\([nN,;:\\"])/g, (_, char: string) => (/[nN]/.test(char) ? '\n' : char))
}

function splitEscaped(value: string, separator: string): string[] {
  const parts = ['']
  let escaped = false
  for (const char of value) {
    if (char === separator && !escaped) parts.push('')
    else parts[parts.length - 1] += char
    escaped = char === '\\' && !escaped
  }
  return parts.map(unescText)
}

function readProperties(text: string) {
  const properties = []
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    let index = -1
    let quoted = false
    let escaped = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === ':' && !quoted) {
        index = i
        break
      }
      if (char === '"' && !escaped) quoted = !quoted
      escaped = char === '\\' && !escaped
    }
    if (index < 0) continue
    const head = line.slice(0, index)
    const key = head.split(';')[0].split('.').at(-1)!.toUpperCase()
    const raw = line.slice(index + 1)
    properties.push({head, key, raw, value: unescText(raw).trim()})
  }
  return properties
}

function emptyVCard(): VCardData {
  return {
    firstName: '',
    lastName: '',
    org: '',
    title: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    address: '',
    note: '',
  }
}

function parseVCard(text: string) {
  const fields: Array<[string, string]> = []
  const vcard = emptyVCard()
  const phones: Array<{value: string; mobile: boolean; work: boolean}> = []
  let name = ''
  for (const {head, key, raw, value} of readProperties(text)) {
    if (!value || key === 'BEGIN' || key === 'END' || key === 'VERSION') continue
    const label = VCARD_LABELS[key]
    if (label && !(key === 'N' && fields.some(([label]) => label === 'name'))) {
      const display =
        key === 'ADR' || key === 'N' || key === 'ORG'
          ? splitEscaped(raw, ';')
              .map((part) => part.trim())
              .filter(Boolean)
              .join(key === 'ADR' ? ', ' : ' ')
          : value
      fields.push([label, display])
    }
    switch (key) {
      case 'N': {
        const [last = '', first = '', middle = ''] = splitEscaped(raw, ';')
        vcard.lastName = last.trim()
        vcard.firstName = [first.trim(), middle.trim()].filter(Boolean).join(' ')
        break
      }
      case 'FN':
        name = value
        break
      case 'ORG':
        vcard.org = splitEscaped(raw, ';').filter(Boolean).join(' ')
        break
      case 'TITLE':
        vcard.title = value
        break
      case 'TEL':
        phones.push({value, mobile: /CELL|MOBILE/i.test(head), work: /WORK/i.test(head)})
        break
      case 'EMAIL':
        vcard.email = value
        break
      case 'URL':
        vcard.website = value
        break
      case 'ADR':
        vcard.address = splitEscaped(raw, ';')
          .map((s) => s.trim())
          .filter(Boolean)
          .join(', ')
        break
      case 'NOTE':
        vcard.note = value
        break
    }
  }
  if (!vcard.firstName && !vcard.lastName && name) vcard.firstName = name
  vcard.mobile = phones.find((p) => p.mobile)?.value ?? phones.find((p) => !p.work)?.value ?? ''
  vcard.phone =
    phones.find((p) => p.work && p.value !== vcard.mobile)?.value ??
    phones.find((p) => p.value !== vcard.mobile)?.value ??
    ''
  name ||= [vcard.firstName, vcard.lastName].filter(Boolean).join(' ') || vcard.org
  return {fields, name, vcard}
}

function parseMeCard(text: string) {
  const fields: Array<[string, string]> = []
  const vcard = emptyVCard()
  const labels: Record<string, string> = {
    N: 'name',
    TEL: 'phone',
    EMAIL: 'email',
    URL: 'website',
    ADR: 'address',
    NOTE: 'note',
    ORG: 'org',
  }
  const re = /([A-Z-]+):((?:\\.|[^;])*);/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text.slice(7)))) {
    const key = match[1].toUpperCase()
    const value = unescText(match[2]).trim()
    if (labels[key] && value) fields.push([labels[key], value.replace(/,/g, ' ')])
    switch (key) {
      case 'N': {
        const parts = splitEscaped(match[2], ',')
        if (parts.length > 1) {
          vcard.lastName = parts[0].trim()
          vcard.firstName = parts
            .slice(1)
            .map((s) => s.trim())
            .join(' ')
        } else vcard.firstName = value
        break
      }
      case 'TEL':
        if (!vcard.mobile) vcard.mobile = value
        else if (!vcard.phone) vcard.phone = value
        break
      case 'EMAIL':
        vcard.email = value
        break
      case 'URL':
        vcard.website = value
        break
      case 'ADR':
        vcard.address = value
        break
      case 'NOTE':
        vcard.note = value
        break
      case 'ORG':
        vcard.org = value
        break
    }
  }
  const name = [vcard.firstName, vcard.lastName].filter(Boolean).join(' ') || vcard.org
  return {fields, name, vcard}
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

function parseIcsDate(raw: string, head: string) {
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(raw)
  if (date) {
    return {
      value: Temporal.PlainDate.from(`${date[1]}-${date[2]}-${date[3]}`).toString(),
      allDay: true,
      zoned: null,
    }
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(raw)
  if (!dt) throw new RangeError('Invalid iCalendar date')
  const [, y, mo, d, h, mi, sec = '00', utc] = dt
  const plain = Temporal.PlainDateTime.from(`${y}-${mo}-${d}T${h}:${mi}:${sec}`)
  const zone = utc ? 'UTC' : /TZID=(?:"([^"]+)"|([^;]+))/i.exec(head)?.slice(1).find(Boolean)
  return {
    value: plain.toString({smallestUnit: plain.second ? 'second' : 'minute'}),
    allDay: false,
    zoned: zone ? plain.toZonedDateTime(zone, {disambiguation: 'compatible'}) : null,
  }
}

function parseEvent(text: string) {
  const body =
    /(?:^|\r?\n)BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT(?:$|\r?\n)/i.exec(text)?.[1] ?? text
  const properties = readProperties(body)
  const get = (key: string) => properties.find((p) => p.key === key)
  const title = get('SUMMARY')?.value ?? ''
  const location = get('LOCATION')?.value ?? ''
  const description = get('DESCRIPTION')?.value ?? ''
  const start = get('DTSTART')
  const end = get('DTEND')
  const fields: Array<[string, string]> = []
  for (const [key, property] of [
    ['start', start],
    ['end', end],
  ] as const) {
    if (property) {
      const zone = /TZID=(?:"([^"]+)"|([^;]+))/i.exec(property.head)?.slice(1).find(Boolean)
      fields.push([key, `${formatIcs(property.raw)}${zone ? ` (${zone})` : ''}`])
    }
  }
  if (location) fields.push(['location', location])
  if (description) fields.push(['note', description])
  let event: EventData | null = null
  try {
    const parsedStart = start ? parseIcsDate(start.raw, start.head) : null
    const parsedEnd = end ? parseIcsDate(end.raw, end.head) : null
    if (parsedStart && parsedEnd && parsedStart.allDay !== parsedEnd.allDay)
      throw new RangeError('Mixed iCalendar date types')
    const allDay = Boolean(parsedStart?.allDay)
    let startValue = parsedStart?.value ?? ''
    let endValue = parsedEnd?.value ?? ''
    let timeZone: string | undefined
    if (parsedStart?.zoned || parsedEnd?.zoned) {
      timeZone = 'UTC'
      const asUtc = (parsed: NonNullable<typeof parsedStart>) => {
        const zoned =
          parsed.zoned ??
          Temporal.PlainDateTime.from(parsed.value).toZonedDateTime(Temporal.Now.timeZoneId(), {
            disambiguation: 'compatible',
          })
        const plain = zoned.withTimeZone('UTC').toPlainDateTime()
        return plain.toString({smallestUnit: plain.second ? 'second' : 'minute'})
      }
      startValue = parsedStart ? asUtc(parsedStart) : ''
      endValue = parsedEnd ? asUtc(parsedEnd) : ''
    }
    if (allDay && endValue) {
      endValue = Temporal.PlainDate.from(endValue).subtract({days: 1}).toString()
      if (startValue && endValue < startValue) throw new RangeError('Invalid iCalendar end')
    }
    event = {title, location, description, start: startValue, end: endValue, allDay, timeZone}
  } catch {
    // Unsupported TZIDs or invalid dates remain inspectable/downloadable without a lossy reissue.
  }
  return {fields, title, event}
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
  if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(text)) return {type: 'event', ...parseEvent(text)}

  if (/^mailto:/i.test(text)) {
    const [address, query = ''] = text.slice(7).split('?')
    const q = safeParams(query)
    return {
      type: 'email',
      to: safeDecode(address),
      subject: q.get('subject') ?? '',
      body: q.get('body') ?? '',
    }
  }
  if (/^MATMSG:/i.test(text)) {
    const to = /TO:([^;]*)/i.exec(text)?.[1] ?? ''
    return {
      type: 'email',
      to,
      subject: /SUB:([^;]*)/i.exec(text)?.[1] ?? '',
      body: /BODY:([^;]*)/i.exec(text)?.[1] ?? '',
    }
  }
  if (/^tel:/i.test(text)) return {type: 'phone', phone: safeDecode(text.slice(4))}
  // RFC 5724 URI ("sms:+849…?body=Hi") — checked before the colon form it would otherwise match.
  if (/^sms:[^:]*$/i.test(text)) {
    const [phone, query = ''] = text.slice(4).split('?')
    return {type: 'sms', phone: safeDecode(phone), message: safeParams(query).get('body') ?? ''}
  }
  if (/^(SMSTO|SMS):/i.test(text)) {
    const [, phone = '', ...rest] = text.split(':')
    return {type: 'sms', phone: safeDecode(phone), message: rest.join(':')}
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
