/**
 * Serverless payment links: the fields live in the URL fragment (#…), which browsers never send to
 * a server, so links stay private and work offline. A link can opt in to a detailed link preview:
 * its bank, name and amount then go in the query string instead, from which the host writes them
 * into the page that Zalo, Facebook and the like fetch (netlify/edge-functions/pay-preview.ts).
 *
 * That edge function runs in Deno and imports this module, so it must not import anything.
 */
export interface PayLinkData {
  bin: string
  acc: string
  name?: string
  amount?: number
  memo?: string
  card?: boolean
  note?: string
  /** Expiry as a unix timestamp (ms). */
  exp?: number
  /** Accent colour for the payment page. */
  accent?: string
}

/** The fields a link with a detailed preview carries in its query string; the others stay after the `#`. */
const PREVIEW_KEYS = ['b', 'n', 'm']

export function encodePayLink(d: PayLinkData): string {
  const p = new URLSearchParams()
  p.set('b', d.bin)
  p.set('a', d.acc)
  if (d.name) p.set('n', d.name)
  if (d.amount) p.set('m', String(Math.round(d.amount)))
  if (d.memo) p.set('c', d.memo)
  if (d.card) p.set('t', 'card')
  if (d.note) p.set('o', d.note)
  if (d.exp) p.set('e', String(Math.round(d.exp / 1000)))
  if (d.accent) p.set('k', d.accent.replace('#', ''))
  return p.toString()
}

/** The fields of a link, with `bin` and `acc` empty when it lacks them. */
function readFields(p: URLSearchParams): PayLinkData {
  const amount = Number(p.get('m') ?? p.get('amount') ?? '')
  const exp = Number(p.get('e') ?? '')
  const accent = p.get('k')
  return {
    bin: p.get('b') ?? p.get('bank') ?? '',
    acc: p.get('a') ?? p.get('acc') ?? '',
    name: p.get('n') ?? p.get('name') ?? undefined,
    amount: Number.isSafeInteger(amount) && amount > 0 && amount < 500_000_000 ? amount : undefined,
    memo: p.get('c') ?? p.get('memo') ?? undefined,
    card: p.get('t') === 'card',
    note: p.get('o') ?? undefined,
    exp: Number.isFinite(exp) && exp > 0 ? exp * 1000 : undefined,
    accent: accent && /^[0-9a-f]{3,8}$/i.test(accent) ? `#${accent}` : undefined,
  }
}

/** A link's payment, from its fragment and query string. A field in the query wins, so the page shows what the preview did. */
export function decodePayLink(hash: string, search = ''): PayLinkData | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  for (const [key, value] of new URLSearchParams(search)) p.set(key, value)
  const data = readFields(p)
  return data.bin && data.acc ? data : null
}

/** What a detailed link preview shows, from the query string; null when the link has none. */
export function payLinkPreview(search: string): Pick<PayLinkData, 'bin' | 'name' | 'amount'> | null {
  const {bin, name, amount} = readFields(new URLSearchParams(search))
  return name || amount ? {bin, name, amount} : null
}

/** The link to a payment's page; with `preview`, a detailed link preview (see above). */
export function payLinkUrl(d: PayLinkData, preview = false): string {
  const base = typeof location !== 'undefined' ? location.origin : 'https://qrviet.app'
  const page = `${base}${import.meta.env?.BASE_URL ?? '/'}pay`
  const fields = new URLSearchParams(encodePayLink(d))
  if (!preview) return `${page}#${fields}`
  const query = new URLSearchParams()
  for (const key of PREVIEW_KEYS) {
    const value = fields.get(key)
    if (value === null) continue
    query.set(key, value)
    fields.delete(key)
  }
  return `${page}?${query}#${fields}`
}
