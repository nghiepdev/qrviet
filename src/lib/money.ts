/** VND formatting, shorthand parsing ("150k", "1tr2") and amount-in-words (vi/en). */

export const AMOUNT_LIMIT = 500_000_000 // Napas 247 exclusive upper bound (strictly under 500M VND)

/**
 * Read a plain numeric string as an amount: digits with an optional "." decimal
 * part ("50000.00", as carried in EMV tag 54) or Vietnamese grouping ("1.234.567").
 */
function numericValue(value: string): number {
  const v = value.trim()
  if (/^\d+(\.\d+)?$/.test(v) && !/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v)
  return Number(v.replace(/[^\d]/g, ''))
}

/** 1234567 → "1.234.567" (Vietnamese grouping). */
export function formatVnd(value: number | string | null | undefined, withSymbol = false): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : numericValue(String(value))
  if (!Number.isFinite(n)) return ''
  const s = BigInt(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return withSymbol ? `${s} ₫` : s
}

const UNITS: Array<[RegExp, number]> = [
  [/^(tỷ|tỉ|ty|ti|b|bn|bil)$/, 1_000_000_000],
  [/^(triệu|trieu|tr|m|mil|củ|cu)$/, 1_000_000],
  [/^(nghìn|nghin|ngàn|ngan|ngh|ng|k|n)$/, 1_000],
]
/** Currency markers that carry no value: "đ", "₫", "VND", "VNĐ", "đồng". */
const CURRENCY = /(₫|vnđ|vnd|đồng|dong)/g
const LETTER = '[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]'
const TOKEN =
  /\d+(?:[.,]\d+)*|[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+|[^\s\d]/g

interface NumberToken {
  value: number
  /** Raw digits when the token is a plain integer (keeps leading zeros: "05"). */
  digits: string | null
}

/** "1.250.000" / "1,250,000" are groups of thousands; "1.5" / "1,5" are decimals. */
function readNumber(tok: string): NumberToken | null {
  if (/^\d+$/.test(tok)) return {value: Number(tok), digits: tok}
  if (/^\d{1,3}([.,]\d{3})+$/.test(tok) && new Set(tok.match(/[.,]/g)).size === 1) {
    return {value: Number(tok.replace(/[.,]/g, '')), digits: null}
  }
  if (/^\d+[.,]\d+$/.test(tok)) return {value: Number(tok.replace(',', '.')), digits: null}
  return null
}

/**
 * Parse human input into an integer VND amount, or null when it can't be read
 * unambiguously (never guesses: unknown words or two bare numbers → null).
 *   "150k" → 150 000 · "1tr2" → 1 200 000 · "1tr05" → 1 050 000 · "1.5tr" → 1 500 000
 *   "2 triệu 300k" → 2 300 000 · "1.500k" → 1 500 000 · "100.000đ" → 100 000
 *   "1.250.000 ₫" → 1 250 000 · "50,000 VND" → 50 000 · "50000.00" → 50 000
 * Values above the 13-digit tag-54 limit are returned as-is so validation can flag them.
 */
export function parseAmount(input: string): number | null {
  const s = input
    .toLowerCase()
    .replace(CURRENCY, ' ')
    .replace(new RegExp(`(\\d)\\s*[đd](?!${LETTER})`, 'g'), '$1 ') // "100đ", "50 d"
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\d{1,3}(?: \d{3})+\b/g, (m) => m.replace(/ /g, '')) // "1 500 000"
  if (!s) return null
  const tokens = s.match(TOKEN)
  if (!tokens) return null

  let total = 0
  let pending: NumberToken | null = null
  let lastUnit = 0
  for (const tok of tokens) {
    if (/^\d/.test(tok)) {
      if (pending) return null // two bare numbers in a row ("150000 101") — ambiguous
      const num = readNumber(tok)
      if (!num) return null
      pending = num
      continue
    }
    const unit = UNITS.find(([re]) => re.test(tok))?.[1]
    if (!unit || !pending) return null // unknown word, stray symbol, or unit without a number
    total += pending.value * unit
    pending = null
    lastUnit = unit
  }
  if (pending) {
    if (lastUnit > 1) {
      // Trailing digits after a unit are a fraction of it: "1tr2" = 1.2tr, "1tr05" = 1.05tr.
      if (pending.digits === null) return null
      total += Number(`0.${pending.digits}`) * lastUnit
    } else {
      total += pending.value
    }
  }
  const rounded = Math.round(total)
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null
}

// ---------------------------------------------------------------------------
// Vietnamese number reading
// ---------------------------------------------------------------------------

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ']

function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const parts: string[] = []
  if (full || h > 0) parts.push(`${VI_DIGITS[h]} trăm`)
  if (t === 0) {
    if (u > 0 && (full || h > 0)) parts.push('lẻ')
  } else if (t === 1) {
    parts.push('mười')
  } else {
    parts.push(`${VI_DIGITS[t]} mươi`)
  }
  if (u > 0) {
    if (u === 1 && t > 1) parts.push('mốt')
    else if (u === 5 && t > 0) parts.push('lăm')
    else if (u === 4 && t > 1) parts.push('tư')
    else parts.push(VI_DIGITS[u])
  }
  return parts.join(' ')
}

/** Read 0 < n < 1e9 as "… triệu … nghìn …". `full` reads leading zeros ("không trăm lẻ…"). */
function readBelowBillion(n: number, full: boolean): string {
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const units = n % 1000
  const parts: string[] = []
  if (millions) parts.push(readTriple(millions, full), VI_SCALES[2])
  if (thousands) parts.push(readTriple(thousands, full || parts.length > 0), VI_SCALES[1])
  if (units) parts.push(readTriple(units, full || parts.length > 0))
  return parts.join(' ')
}

function readVietnamese(n: number, full = false): string {
  if (n >= 1_000_000_000) {
    const high = Math.floor(n / 1_000_000_000)
    const low = n % 1_000_000_000
    return `${readVietnamese(high, full)} ${VI_SCALES[3]}${low ? ` ${readBelowBillion(low, true)}` : ''}`
  }
  return readBelowBillion(n, full)
}

/** 1250000 → "Một triệu hai trăm năm mươi nghìn đồng". */
export function amountToVietnameseWords(amount: number, currency = 'đồng'): string {
  if (!Number.isFinite(amount) || amount < 0) return ''
  if (Math.floor(amount) === 0) return `Không ${currency}`.trim()
  const text = readVietnamese(Math.floor(amount)).replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${currency}`.trim()
}

// ---------------------------------------------------------------------------
// English number reading
// ---------------------------------------------------------------------------

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion']

function enTriple(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const out: string[] = []
  if (h) out.push(`${EN_ONES[h]} hundred`)
  if (r) {
    if (r < 20) out.push(EN_ONES[r])
    else out.push(EN_TENS[Math.floor(r / 10)] + (r % 10 ? `-${EN_ONES[r % 10]}` : ''))
  }
  return out.join(' ')
}

/** 1250000 → "One million two hundred fifty thousand dong". */
export function amountToEnglishWords(amount: number, currency = 'dong'): string {
  if (!Number.isFinite(amount) || amount < 0) return ''
  if (amount === 0) return `Zero ${currency}`
  let n = Math.floor(amount)
  const parts: string[] = []
  let i = 0
  while (n > 0) {
    const g = n % 1000
    if (g) parts.unshift(enTriple(g) + (EN_SCALES[i] ? ` ${EN_SCALES[i]}` : ''))
    n = Math.floor(n / 1000)
    i++
  }
  const text = parts.join(' ')
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${currency}`
}

export function amountToWords(amount: number, locale: 'vi' | 'en'): string {
  return locale === 'en' ? amountToEnglishWords(amount) : amountToVietnameseWords(amount)
}

/** Compact label for chips: 50000 → "50k", 1500000 → "1,5tr". */
export function shortAmount(amount: number, locale: 'vi' | 'en' = 'vi'): string {
  const fmt = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', locale === 'vi' ? ',' : '.')
  if (amount >= 1_000_000_000)
    return `${fmt(amount / 1_000_000_000)}${locale === 'vi' ? ' tỷ' : 'B'}`
  if (amount >= 1_000_000) return `${fmt(amount / 1_000_000)}${locale === 'vi' ? 'tr' : 'M'}`
  if (amount >= 1_000) return `${fmt(amount / 1_000)}k`
  return String(amount)
}
