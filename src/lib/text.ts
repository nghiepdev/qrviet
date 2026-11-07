/** Vietnamese-aware text helpers shared by search, VietQR content and exports. */

const D_MAP: Record<string, string> = {đ: 'd', Đ: 'D'}

/** Strip Vietnamese diacritics: "Chuyển tiền Đà Nẵng" → "Chuyen tien Da Nang". */
export function removeDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => D_MAP[c] ?? c)
    .normalize('NFC')
}

/** Lowercase, accent-free, single-spaced — for fuzzy matching. */
export function foldForSearch(input: string): string {
  return removeDiacritics(input).toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True when every query token appears somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = foldForSearch(query)
  if (!q) return true
  const h = foldForSearch(haystack)
  return q.split(' ').every((token) => h.includes(token))
}

export type ContentMode = 'strict' | 'relaxed'

/**
 * Bank transfer descriptions travel through NAPAS as plain ASCII. Some banks
 * reject punctuation, so `strict` keeps only letters, digits and spaces;
 * `relaxed` additionally keeps a few separators most banks accept.
 */
export function sanitizeTransferContent(input: string, mode: ContentMode = 'relaxed'): string {
  const ascii = removeDiacritics(input)
  const allowed = mode === 'strict' ? /[^A-Za-z0-9 ]/g : /[^A-Za-z0-9 .,\-_/]/g
  return ascii.replace(allowed, ' ').replace(/\s+/g, ' ').trimStart()
}

/** Account holder names are conventionally upper-case ASCII. */
export function normalizeAccountName(input: string): string {
  return removeDiacritics(input)
    .toUpperCase()
    .replace(/[^A-Z0-9 .,\-&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trimStart()
}

/** Keep only characters valid in an account / card number. */
export function normalizeAccountNumber(input: string): string {
  return input.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

/** Group digits for readability: 0123456789 → 0123 4567 89. */
export function groupDigits(value: string, size = 4): string {
  return value.replace(new RegExp(`(.{${size}})(?=.)`, 'g'), '$1 ')
}

/** Filename-safe slug (ASCII, dashes). */
export function slugify(input: string, fallback = 'qrviet'): string {
  const s = removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || fallback
}

/** Short random id for local records. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
