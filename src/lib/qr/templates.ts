/** Card templates for exported VietQR images (QR only → printable standee). */
import {fitText, wrapText, type Measure, type Scene, type SceneNode} from './scene.ts'
import type {PaintOptions, QrGeometry} from './render.ts'

export type TemplateId = 'qr' | 'minimal' | 'compact' | 'card' | 'standee'
export const TEMPLATE_IDS: TemplateId[] = ['compact', 'card', 'minimal', 'standee', 'qr']

export interface TemplateLabels {
  transfer: string
  bank: string
  accountName: string
  accountNumber: string
  amount: string
  purpose: string
  scanToPay: string
  scanHint: string
  acceptedEverywhere: string
  madeWith: string
}

export interface TemplateInfo {
  bankShort?: string
  bankName?: string
  bankLogo?: string | null
  accountName?: string
  accountNumber?: string
  amount?: number | null
  amountText?: string
  amountWords?: string
  purpose?: string
  title?: string
  labels: TemplateLabels
  accent: string
  showBrand: boolean
}

export const TEMPLATE_ACCENTS = [
  '#d7263d', // son (brand red)
  '#1d4ed8', // royal blue
  '#0f766e', // jade
  '#15803d', // leaf
  '#7c3aed', // violet
  '#c2410c', // terracotta
  '#be185d', // lotus
  '#0f172a', // ink
] as const

export const FONT_STACK = '"Be Vietnam Pro", "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
export const MONO_STACK = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace'

const INK = '#1b1418'
const MUTED = '#6b5a60'
const LINE = '#eadfe1'

interface QrInput {
  geo: QrGeometry
  opts: PaintOptions
}

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const ch = (shift: number) => {
    const c = (n >> shift) & 255
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount
    return Math.round(Math.min(255, Math.max(0, v)))
  }
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`
}

function brandMark(x: number, y: number, s: number, star = '#ffc93c'): SceneNode[] {
  // Miniature of the QRViet mark (three finders + V + star) in a w×w box.
  const k = s / 512
  const ring = (rx: number, ry: number): SceneNode[] => [
    {t: 'rect', x: x + rx * k, y: y + ry * k, w: 102 * k, h: 102 * k, r: 26 * k, stroke: '#ffffff', strokeWidth: 26 * k},
    {t: 'rect', x: x + (rx + 31) * k, y: y + (ry + 31) * k, w: 40 * k, h: 40 * k, r: 11 * k, fill: '#ffffff'},
  ]
  return [
    {t: 'rect', x, y, w: s, h: s, r: 116 * k, fill: {type: 'linear', x1: x, y1: y, x2: x + s, y2: y + s, stops: [[0, '#f0435a'], [1, '#a5122a']]}},
    ...ring(85, 85),
    ...ring(325, 85),
    ...ring(85, 325),
    {t: 'path', d: `M${x + 199 * k} ${y + 210 * k}L${x + 256 * k} ${y + 310 * k}L${x + 313 * k} ${y + 210 * k}L${x + 284 * k} ${y + 210 * k}L${x + 256 * k} ${y + 262 * k}L${x + 228 * k} ${y + 210 * k}Z`, fill: '#ffffff'},
    {
      t: 'path',
      d: starPath(x + 376 * k, y + 372 * k, 72 * k, 31 * k),
      fill: star,
    },
  ]
}

function starPath(cx: number, cy: number, R: number, r: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180
    const rad = i % 2 === 0 ? R : r
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`
  }
  return `${d}Z`
}

function footerBrand(info: TemplateInfo, cx: number, y: number, color: string): SceneNode[] {
  if (!info.showBrand) return []
  return [
    {t: 'text', x: cx, y, text: info.labels.madeWith, size: 12, weight: 500, color, align: 'middle', letterSpacing: 0.2},
  ]
}

export function buildTemplateScene(template: TemplateId, info: TemplateInfo, qr: QrInput, measure: Measure): Scene {
  switch (template) {
    case 'qr':
      return qrOnly(qr)
    case 'minimal':
      return minimal(info, qr, measure)
    case 'compact':
      return compact(info, qr, measure)
    case 'card':
      return card(info, qr, measure)
    case 'standee':
      return standee(info, qr, measure)
  }
}

const base = (width: number, height: number, nodes: SceneNode[], extra: Partial<Scene> = {}): Scene => ({
  width,
  height,
  nodes,
  fontFamily: FONT_STACK,
  monoFamily: MONO_STACK,
  ...extra,
})

function qrOnly(qr: QrInput): Scene {
  const S = 512
  return base(S, S, [{t: 'qr', x: 0, y: 0, size: S, geo: qr.geo, opts: qr.opts}])
}

function minimal(info: TemplateInfo, qr: QrInput, measure: Measure): Scene {
  const W = 480
  const P = 28
  const nodes: SceneNode[] = []
  const Q = W - P * 2
  nodes.push({t: 'qr', x: P, y: P, size: Q, geo: qr.geo, opts: qr.opts})
  let y = P + Q + 34
  if (info.accountName) {
    const t = fitText(measure, info.accountName, W - P * 2, 22, 700)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 700, color: INK, align: 'middle'})
    y += 28
  }
  const sub = [info.accountNumber, info.bankShort].filter(Boolean).join('  ·  ')
  if (sub) {
    const t = fitText(measure, sub, W - P * 2, 17, 500)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 500, color: MUTED, align: 'middle'})
    y += 30
  }
  if (info.amountText) {
    nodes.push({t: 'text', x: W / 2, y: y + 4, text: info.amountText, size: 26, weight: 800, color: info.accent, align: 'middle'})
    y += 34
  }
  if (info.purpose) {
    const t = fitText(measure, info.purpose, W - P * 2, 15, 500)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 500, color: MUTED, align: 'middle'})
    y += 24
  }
  if (info.showBrand) {
    y += 6
    nodes.push(...footerBrand(info, W / 2, y, '#a2949a'))
    y += 6
  }
  return base(W, y + 18, nodes, {background: '#ffffff', radius: 28})
}

function compact(info: TemplateInfo, qr: QrInput, measure: Measure): Scene {
  const W = 520
  const nodes: SceneNode[] = []
  // Header: bank logo or bank name
  if (info.bankLogo) {
    nodes.push({t: 'image', x: W / 2 - 100, y: 18, w: 200, h: 64, src: info.bankLogo})
  } else if (info.bankShort) {
    nodes.push({t: 'text', x: W / 2, y: 62, text: info.bankShort, size: 28, weight: 800, color: info.accent, align: 'middle'})
  }
  const F = 440
  const fx = (W - F) / 2
  const fy = 96
  nodes.push({t: 'rect', x: fx, y: fy, w: F, h: F, r: 30, fill: '#ffffff', stroke: info.accent, strokeWidth: 4})
  const Q = F - 28
  nodes.push({t: 'qr', x: fx + 14, y: fy + 14, size: Q, geo: qr.geo, opts: qr.opts})
  // "VietQR" tab on the frame
  const tabW = 120
  nodes.push({t: 'rect', x: W / 2 - tabW / 2, y: fy + F - 16, w: tabW, h: 32, r: 16, fill: info.accent})
  nodes.push({t: 'text', x: W / 2, y: fy + F + 6, text: 'VietQR', size: 16, weight: 800, color: '#ffffff', align: 'middle', letterSpacing: 0.5})

  let y = fy + F + 54
  if (info.accountName) {
    const t = fitText(measure, info.accountName, W - 60, 22, 700)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 700, color: INK, align: 'middle'})
    y += 30
  }
  if (info.accountNumber) {
    const t = fitText(measure, info.accountNumber, W - 60, 20, 600, 14, true)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 600, color: INK, align: 'middle', mono: true, letterSpacing: 1})
    y += 26
  }
  if (info.bankName || info.bankShort) {
    const t = fitText(measure, info.bankName || info.bankShort || '', W - 60, 14, 500)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 500, color: MUTED, align: 'middle'})
    y += 26
  }
  if (info.amountText) {
    y += 8
    nodes.push({t: 'text', x: W / 2, y, text: info.amountText, size: 28, weight: 800, color: info.accent, align: 'middle'})
    y += 24
    if (info.amountWords) {
      const t = fitText(measure, info.amountWords, W - 60, 13, 500)
      nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 500, color: MUTED, align: 'middle'})
      y += 22
    }
  }
  if (info.purpose) {
    const lines = wrapText(measure, info.purpose, W - 80, 15, 500, 2)
    for (const line of lines) {
      nodes.push({t: 'text', x: W / 2, y, text: line, size: 15, weight: 500, color: INK, align: 'middle'})
      y += 21
    }
  }
  y += 10
  nodes.push({t: 'line', x1: 40, y1: y, x2: W - 40, y2: y, color: LINE, width: 1})
  y += 24
  nodes.push({t: 'text', x: 40, y, text: 'VietQR  ·  Napas 247', size: 12, weight: 600, color: MUTED})
  if (info.showBrand) nodes.push({t: 'text', x: W - 40, y, text: 'QRViet', size: 12, weight: 800, color: info.accent, align: 'end'})
  return base(W, y + 22, nodes, {background: '#ffffff', radius: 32})
}

function card(info: TemplateInfo, qr: QrInput, measure: Measure): Scene {
  const W = 600
  const nodes: SceneNode[] = []
  const dark = shade(info.accent, -0.35)
  nodes.push({t: 'rect', x: 0, y: 0, w: W, h: 200, fill: {type: 'linear', x1: 0, y1: 0, x2: W, y2: 200, stops: [[0, info.accent], [1, dark]]}})
  // decorative bubbles
  nodes.push({t: 'path', d: circlePath(W - 40, 10, 90), fill: '#ffffff', opacity: 0.08})
  nodes.push({t: 'path', d: circlePath(W - 150, 170, 46), fill: '#ffffff', opacity: 0.06})
  const title = fitText(measure, info.title || info.labels.transfer, 330, 28, 800)
  nodes.push({t: 'text', x: 36, y: 62, text: title.text, size: title.size, weight: 800, color: '#ffffff'})
  if (info.bankName || info.bankShort) {
    const t = fitText(measure, info.bankName || info.bankShort || '', 330, 15, 500)
    nodes.push({t: 'text', x: 36, y: 92, text: t.text, size: t.size, weight: 500, color: 'rgba(255,255,255,0.86)'})
  }
  nodes.push({t: 'rect', x: W - 196, y: 30, w: 160, h: 64, r: 18, fill: '#ffffff'})
  if (info.bankLogo) nodes.push({t: 'image', x: W - 188, y: 34, w: 144, h: 56, src: info.bankLogo})
  else if (info.bankShort) {
    const t = fitText(measure, info.bankShort, 140, 18, 800)
    nodes.push({t: 'text', x: W - 116, y: 69, text: t.text, size: t.size, weight: 800, color: info.accent, align: 'middle'})
  }

  const sheetY = 124
  const Q = 340
  nodes.push({t: 'rect', x: 24, y: sheetY, w: W - 48, h: 0, r: 28, fill: '#ffffff'}) // height patched below
  const sheetIndex = nodes.length - 1
  nodes.push({t: 'rect', x: (W - Q) / 2 - 12, y: sheetY + 26, w: Q + 24, h: Q + 24, r: 24, fill: '#ffffff', stroke: LINE, strokeWidth: 2})
  nodes.push({t: 'qr', x: (W - Q) / 2, y: sheetY + 38, size: Q, geo: qr.geo, opts: qr.opts})
  let y = sheetY + 38 + Q + 40

  const rows: Array<{label: string; value: string; mono?: boolean; accent?: boolean; sub?: string}> = []
  if (info.accountName) rows.push({label: info.labels.accountName, value: info.accountName})
  if (info.accountNumber) rows.push({label: info.labels.accountNumber, value: info.accountNumber, mono: true})
  if (info.bankShort) rows.push({label: info.labels.bank, value: info.bankShort})
  if (info.amountText) rows.push({label: info.labels.amount, value: info.amountText, accent: true, sub: info.amountWords})
  if (info.purpose) rows.push({label: info.labels.purpose, value: info.purpose})

  const left = 56
  const right = W - 56
  rows.forEach((row, i) => {
    if (i > 0) nodes.push({t: 'line', x1: left, y1: y - 26, x2: right, y2: y - 26, color: LINE, width: 1, dash: [4, 5]})
    nodes.push({t: 'text', x: left, y, text: row.label, size: 14, weight: 500, color: MUTED})
    const maxW = right - left - measure(row.label, 14, 500) - 24
    const t = fitText(measure, row.value, maxW, row.accent ? 22 : 17, row.accent ? 800 : 700, 12, row.mono)
    nodes.push({
      t: 'text',
      x: right,
      y,
      text: t.text,
      size: t.size,
      weight: row.accent ? 800 : 700,
      color: row.accent ? info.accent : INK,
      align: 'end',
      mono: row.mono,
      letterSpacing: row.mono ? 0.5 : undefined,
    })
    if (row.sub) {
      const s = fitText(measure, row.sub, right - left, 12, 500)
      nodes.push({t: 'text', x: right, y: y + 20, text: s.text, size: s.size, weight: 500, color: MUTED, align: 'end'})
      y += 18
    }
    y += 50
  })
  y -= 10
  const hint = fitText(measure, info.labels.scanHint, W - 112, 13, 500)
  nodes.push({t: 'text', x: W / 2, y, text: hint.text, size: hint.size, weight: 500, color: MUTED, align: 'middle'})
  y += 26
  const sheet = nodes[sheetIndex]
  if (sheet.t === 'rect') sheet.h = y - sheetY
  y += 28
  if (info.showBrand) {
    nodes.push(...brandMark(W / 2 - 62, y - 15, 20))
    nodes.push({t: 'text', x: W / 2 - 34, y: y + 1, text: info.labels.madeWith, size: 13, weight: 600, color: MUTED})
    y += 26
  } else {
    y += 4
  }
  return base(W, y, nodes, {background: '#f6eff0', radius: 32})
}

function standee(info: TemplateInfo, qr: QrInput, measure: Measure): Scene {
  const W = 620
  const H = 877 // ≈ A-series ratio (A4/A5/A6 print without distortion)
  const nodes: SceneNode[] = []
  const dark = shade(info.accent, -0.4)
  const light = shade(info.accent, 0.18)
  const bg = {type: 'linear' as const, x1: 0, y1: 0, x2: W, y2: H, stops: [[0, light], [0.55, info.accent], [1, dark]] as Array<[number, string]>}
  nodes.push({t: 'path', d: circlePath(W - 30, 40, 150), fill: '#ffffff', opacity: 0.09})
  nodes.push({t: 'path', d: circlePath(30, H - 40, 170), fill: '#ffffff', opacity: 0.07})
  nodes.push({t: 'path', d: starPath(46, 44, 18, 7.5), fill: '#ffc93c', opacity: 0.95})
  nodes.push({t: 'path', d: starPath(W - 52, 128, 11, 4.6), fill: '#ffffff', opacity: 0.55})

  const title = fitText(measure, (info.title || info.labels.scanToPay).toUpperCase(), W - 120, 34, 800, 20)
  nodes.push({t: 'text', x: W / 2, y: 88, text: title.text, size: title.size, weight: 800, color: '#ffffff', align: 'middle', letterSpacing: 0.5})
  const sub = fitText(measure, info.labels.acceptedEverywhere, W - 120, 16, 500)
  nodes.push({t: 'text', x: W / 2, y: 120, text: sub.text, size: sub.size, weight: 500, color: 'rgba(255,255,255,0.9)', align: 'middle'})

  const cx = 56
  const cy = 150
  const cw = W - cx * 2
  const ch = 548
  nodes.push({t: 'rect', x: cx, y: cy, w: cw, h: ch, r: 36, fill: '#ffffff'})
  if (info.bankLogo) nodes.push({t: 'image', x: W / 2 - 90, y: cy + 14, w: 180, h: 58, src: info.bankLogo})
  else if (info.bankShort) nodes.push({t: 'text', x: W / 2, y: cy + 54, text: info.bankShort, size: 26, weight: 800, color: info.accent, align: 'middle'})
  const Q = 360
  const qx = (W - Q) / 2
  const qy = cy + 92
  nodes.push(...brackets(qx - 14, qy - 14, Q + 28, info.accent))
  nodes.push({t: 'qr', x: qx, y: qy, size: Q, geo: qr.geo, opts: qr.opts})
  let y = qy + Q + 44
  if (info.accountName) {
    const t = fitText(measure, info.accountName, cw - 40, 24, 800)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 800, color: INK, align: 'middle'})
    y += 28
  }
  const acc = [info.accountNumber, info.bankShort].filter(Boolean).join('  ·  ')
  if (acc) {
    const t = fitText(measure, acc, cw - 40, 17, 600)
    nodes.push({t: 'text', x: W / 2, y, text: t.text, size: t.size, weight: 600, color: MUTED, align: 'middle'})
  }

  // Amount pill (or the description) between the card and the footer.
  const pillTop = cy + ch + 22
  if (info.amountText) {
    const label = `${info.labels.amount}: ${info.amountText}`
    const t = fitText(measure, label, cw - 40, 24, 800)
    const pw = Math.min(cw, measure(t.text, t.size, 800) + 56)
    nodes.push({t: 'rect', x: W / 2 - pw / 2, y: pillTop, w: pw, h: 52, r: 26, fill: '#ffffff'})
    nodes.push({t: 'text', x: W / 2, y: pillTop + 26 + t.size * 0.36, text: t.text, size: t.size, weight: 800, color: info.accent, align: 'middle'})
  } else if (info.purpose) {
    const t = fitText(measure, info.purpose, cw - 20, 18, 600)
    nodes.push({t: 'text', x: W / 2, y: pillTop + 30, text: t.text, size: t.size, weight: 600, color: '#ffffff', align: 'middle'})
  }
  nodes.push({t: 'text', x: W / 2, y: H - (info.showBrand ? 54 : 34), text: 'VietQR  ·  Napas 247', size: 14, weight: 700, color: 'rgba(255,255,255,0.92)', align: 'middle', letterSpacing: 1})
  if (info.showBrand) nodes.push({t: 'text', x: W / 2, y: H - 28, text: info.labels.madeWith, size: 12, weight: 500, color: 'rgba(255,255,255,0.75)', align: 'middle'})
  return base(W, H, nodes, {background: bg, radius: 36})
}

/** Generic QR with an optional caption pill underneath (QR studio). */
export function buildCaptionScene(qr: QrInput, caption: string, accent: string, measure: Measure): Scene {
  const S = 512
  if (!caption.trim()) return qrOnly(qr)
  const P = 28
  const W = S + P * 2
  const nodes: SceneNode[] = [{t: 'qr', x: P, y: P, size: S, geo: qr.geo, opts: qr.opts}]
  const t = fitText(measure, caption.trim(), W - 100, 30, 800, 18)
  const pillW = Math.min(W - P * 2, measure(t.text, t.size, 800) + 64)
  const y = P + S + 22
  nodes.push({t: 'rect', x: (W - pillW) / 2, y, w: pillW, h: 60, r: 30, fill: accent})
  nodes.push({t: 'text', x: W / 2, y: y + 30 + t.size * 0.36, text: t.text, size: t.size, weight: 800, color: '#ffffff', align: 'middle'})
  const bg = qr.opts.style.transparentBg ? undefined : qr.opts.style.bg
  return base(W, y + 60 + P, nodes, {background: bg, radius: 36})
}

function brackets(x: number, y: number, s: number, color: string): SceneNode[] {
  const L = 38
  const w = 6
  const d = (x1: number, y1: number, x2: number, y2: number): SceneNode => ({t: 'line', x1, y1, x2, y2, color, width: w})
  return [
    d(x, y + L, x, y),
    d(x, y, x + L, y),
    d(x + s - L, y, x + s, y),
    d(x + s, y, x + s, y + L),
    d(x + s, y + s - L, x + s, y + s),
    d(x + s, y + s, x + s - L, y + s),
    d(x + L, y + s, x, y + s),
    d(x, y + s, x, y + s - L),
  ]
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
}
