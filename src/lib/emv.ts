/**
 * EMVCo Merchant-Presented-Mode QR primitives: TLV encoding/decoding and the
 * CRC-16/CCITT-FALSE checksum (poly 0x1021, init 0xFFFF) used in tag 63.
 */

export interface TlvField {
  id: string
  length: number
  value: string
  /** Nested fields for template tags (26–51, 62, 64, 80–99). */
  children?: TlvField[]
}

/** Encode one TLV field. Returns '' for empty values so optional tags vanish. */
export function tlv(id: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  if (!/^\d{2}$/.test(id)) throw new Error(`Invalid EMV tag id "${id}"`)
  if (value.length > 99) throw new Error(`EMV tag ${id} is ${value.length} chars (max 99)`)
  return id + String(value.length).padStart(2, '0') + value
}

export function crc16ccitt(input: string): string {
  let crc = 0xffff
  const bytes = new TextEncoder().encode(input)
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Append tag 63 with the checksum computed over everything including "6304". */
export function withCrc(payloadWithoutCrc: string): string {
  const body = payloadWithoutCrc + '6304'
  return body + crc16ccitt(body)
}

const TEMPLATE_IDS = new Set<string>(['62', '64'])
function isTemplate(id: string, parent?: string): boolean {
  if (parent) return false
  const n = Number(id)
  return (n >= 26 && n <= 51) || (n >= 80 && n <= 99) || TEMPLATE_IDS.has(id)
}

export class TlvParseError extends Error {
  readonly offset: number
  constructor(message: string, offset: number) {
    super(message)
    this.name = 'TlvParseError'
    this.offset = offset
  }
}

/** Parse a TLV string. Nested templates are parsed one level deep (and 38/01 two). */
export function parseTlv(input: string, parent?: string, depth = 0): TlvField[] {
  const fields: TlvField[] = []
  let i = 0
  while (i < input.length) {
    if (i + 4 > input.length) throw new TlvParseError('Truncated field header', i)
    const id = input.slice(i, i + 2)
    const lenStr = input.slice(i + 2, i + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) {
      throw new TlvParseError(`Invalid field header "${id}${lenStr}"`, i)
    }
    const length = Number(lenStr)
    const value = input.slice(i + 4, i + 4 + length)
    if (value.length !== length) throw new TlvParseError(`Field ${id} is truncated`, i)
    const field: TlvField = {id, length, value}
    const nested =
      isTemplate(id, parent) ||
      (depth === 1 && parent && Number(parent) >= 26 && Number(parent) <= 51 && id === '01')
    if (nested && depth < 2) {
      try {
        field.children = parseTlv(value, id, depth + 1)
      } catch {
        // Some issuers put raw (non-TLV) data in templates; keep the raw value.
      }
    }
    fields.push(field)
    i += 4 + length
  }
  return fields
}

export function findField(fields: TlvField[] | undefined, id: string): TlvField | undefined {
  return fields?.find((f) => f.id === id)
}

export interface CrcCheck {
  present: boolean
  valid: boolean
  expected?: string
  actual?: string
}

/**
 * Walk the top-level TLV fields and split off tag 63. Locating the CRC by text
 * search is wrong: a checksum or an amount can itself contain "6304".
 * Returns null when the fields before tag 63 are malformed.
 */
export function splitCrc(payload: string): {body: string; crc: string | null} | null {
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    if (id === '63') {
      const complete =
        payload.slice(i + 2, i + 4) === '04' &&
        payload.length === i + 8 &&
        /^[0-9A-Fa-f]{4}$/.test(payload.slice(i + 4))
      return {body: payload.slice(0, i), crc: complete ? payload.slice(i + 4).toUpperCase() : null}
    }
    const lenStr = payload.slice(i + 2, i + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) return null
    const next = i + 4 + Number(lenStr)
    if (next > payload.length) return null
    i = next
  }
  return {body: payload, crc: null}
}

export function checkCrc(payload: string): CrcCheck {
  const parts = splitCrc(payload)
  if (!parts?.crc) return {present: false, valid: false}
  const expected = crc16ccitt(`${parts.body}6304`)
  return {present: true, valid: parts.crc === expected, expected, actual: parts.crc}
}

/** Recompute tag 63 for a payload (missing, partial or wrong CRC); null if the body is malformed. */
export function repairCrc(payload: string): string | null {
  const parts = splitCrc(payload.trim())
  return parts ? withCrc(parts.body) : null
}

/** Human labels for well-known root tags — used by the TLV inspector. */
export const EMV_TAG_NAMES: Record<string, string> = {
  '00': 'Payload Format Indicator',
  '01': 'Point of Initiation Method',
  '02': 'Visa',
  '04': 'Mastercard',
  '15': 'UnionPay',
  '38': 'NAPAS 247 (VietQR)',
  '52': 'Merchant Category Code',
  '53': 'Transaction Currency',
  '54': 'Transaction Amount',
  '55': 'Tip or Convenience Indicator',
  '56': 'Convenience Fee (fixed)',
  '57': 'Convenience Fee (%)',
  '58': 'Country Code',
  '59': 'Merchant Name',
  '60': 'Merchant City',
  '61': 'Postal Code',
  '62': 'Additional Data',
  '63': 'CRC',
  '64': 'Merchant Info — Language Template',
}

export const ADDITIONAL_DATA_NAMES: Record<string, string> = {
  '01': 'Bill Number',
  '02': 'Mobile Number',
  '03': 'Store Label',
  '04': 'Loyalty Number',
  '05': 'Reference Label',
  '06': 'Customer Label',
  '07': 'Terminal Label',
  '08': 'Purpose of Transaction',
  '09': 'Additional Consumer Data Request',
}
