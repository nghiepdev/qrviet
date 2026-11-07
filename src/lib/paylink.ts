/**
 * Serverless payment links: every field lives in the URL fragment (#…), which
 * browsers never send to the server, so links stay private and work offline.
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

export function decodePayLink(hash: string): PayLinkData | null {
  const raw = hash.replace(/^#/, '')
  if (!raw) return null
  const p = new URLSearchParams(raw)
  const bin = p.get('b') ?? p.get('bank') ?? ''
  const acc = p.get('a') ?? p.get('acc') ?? ''
  if (!bin || !acc) return null
  const amount = Number(p.get('m') ?? p.get('amount') ?? '')
  const exp = Number(p.get('e') ?? '')
  const accent = p.get('k')
  return {
    bin,
    acc,
    name: p.get('n') ?? p.get('name') ?? undefined,
    amount: Number.isSafeInteger(amount) && amount > 0 && amount <= 9_999_999_999_999 ? amount : undefined,
    memo: p.get('c') ?? p.get('memo') ?? undefined,
    card: p.get('t') === 'card',
    note: p.get('o') ?? undefined,
    exp: Number.isFinite(exp) && exp > 0 ? exp * 1000 : undefined,
    accent: accent && /^[0-9a-f]{3,8}$/i.test(accent) ? `#${accent}` : undefined,
  }
}

export function payLinkUrl(d: PayLinkData): string {
  const base = typeof location !== 'undefined' ? location.origin : 'https://qrviet.app'
  return `${base}${import.meta.env?.BASE_URL ?? '/'}pay#${encodePayLink(d)}`
}
