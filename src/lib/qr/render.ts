/**
 * Styled QR renderer. Geometry is produced once as SVG path data in "module"
 * units, then painted either as SVG (preview, .svg export) or onto a canvas via
 * Path2D (PNG/JPEG export) so both outputs are pixel-identical.
 */
import {encode} from 'uqr'

export type Ecc = 'L' | 'M' | 'Q' | 'H'
export type DotShape = 'square' | 'rounded' | 'dots' | 'fluid' | 'diamond' | 'classy' | 'bars-v' | 'bars-h'
export type EyeFrameShape = 'square' | 'rounded' | 'circle' | 'leaf' | 'cushion'
export type EyeBallShape = 'square' | 'rounded' | 'circle' | 'diamond' | 'leaf'
export type GradientKind = 'none' | 'linear' | 'radial'
export type LogoPlate = 'none' | 'square' | 'rounded' | 'circle'

export interface QrLogo {
  src: string
  /** Fraction of the symbol width (without margin). */
  size: number
  plate: LogoPlate
  plateColor: string
  /** Remove modules under the logo so it never overlaps dots. */
  excavate: boolean
}

export interface QrStyle {
  ecc: Ecc
  margin: number
  dots: DotShape
  eyeFrame: EyeFrameShape
  eyeBall: EyeBallShape
  fg: string
  fg2: string
  gradient: GradientKind
  gradientRotation: number
  bg: string
  transparentBg: boolean
  eyeFrameColor: string | null
  eyeBallColor: string | null
}

export const DEFAULT_QR_STYLE: QrStyle = {
  ecc: 'M',
  margin: 2,
  dots: 'square',
  eyeFrame: 'square',
  eyeBall: 'square',
  fg: '#111111',
  fg2: '#d7263d',
  gradient: 'none',
  gradientRotation: 45,
  bg: '#ffffff',
  transparentBg: false,
  eyeFrameColor: null,
  eyeBallColor: null,
}

export interface QrModel {
  text: string
  version: number
  size: number
  data: boolean[][]
}

export function makeQr(text: string, ecc: Ecc = 'M'): QrModel {
  const res = encode(text, {ecc, border: 0, boostEcc: false})
  return {text, version: res.version, size: res.size, data: res.data}
}

export interface QrGeometry {
  /** Total width in modules, including margin. */
  total: number
  margin: number
  size: number
  dots: string
  eyeFrames: string
  eyeBalls: string
  /** Logo box in module units (already offset by margin). */
  logoBox: {x: number; y: number; w: number; h: number; plate: number} | null
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString()

function isFinderZone(x: number, y: number, size: number): boolean {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
}

function roundedRect(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : '') +
    'Z'
  )
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`
}

function diamond(cx: number, cy: number, r: number): string {
  return `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy)}L${f(cx)} ${f(cy + r)}L${f(cx - r)} ${f(cy)}Z`
}

type Corner = 'tl' | 'tr' | 'br' | 'bl'
/** Which finder corner faces the symbol centre — leaf shapes keep that one sharp. */
const INNER_CORNER: Corner[] = ['br', 'bl', 'tr']

function shapeBox(
  shape: EyeFrameShape | EyeBallShape,
  x: number,
  y: number,
  s: number,
  inner: Corner,
  isBall: boolean,
): string {
  switch (shape) {
    case 'square':
      return roundedRect(x, y, s, s, [0, 0, 0, 0])
    case 'rounded': {
      const r = isBall ? s * 0.28 : s * 0.3
      return roundedRect(x, y, s, s, [r, r, r, r])
    }
    case 'cushion': {
      const r = s * 0.42
      return roundedRect(x, y, s, s, [r, r, r, r])
    }
    case 'circle':
      return circle(x + s / 2, y + s / 2, s / 2)
    case 'diamond':
      return diamond(x + s / 2, y + s / 2, s / 2 + (isBall ? 0.15 : 0))
    case 'leaf': {
      const big = s * 0.48
      const small = isBall ? s * 0.08 : s * 0.12
      const r: Record<Corner, number> = {tl: big, tr: big, br: big, bl: big}
      r[inner] = small
      return roundedRect(x, y, s, s, [r.tl, r.tr, r.br, r.bl])
    }
  }
}

function dotPath(shape: DotShape, x: number, y: number, n: (dx: number, dy: number) => boolean): string {
  switch (shape) {
    case 'square':
      return '' // merged into runs by the caller
    case 'rounded':
      return roundedRect(x + 0.06, y + 0.06, 0.88, 0.88, [0.3, 0.3, 0.3, 0.3])
    case 'dots':
      return circle(x + 0.5, y + 0.5, 0.44)
    case 'diamond':
      return diamond(x + 0.5, y + 0.5, 0.56)
    case 'classy': {
      const top = n(0, -1)
      const left = n(-1, 0)
      const right = n(1, 0)
      const bottom = n(0, 1)
      const R = 0.5
      return roundedRect(x, y, 1, 1, [!top && !left ? R : 0, 0, !bottom && !right ? R : 0, 0])
    }
    case 'fluid': {
      const top = n(0, -1)
      const left = n(-1, 0)
      const right = n(1, 0)
      const bottom = n(0, 1)
      const R = 0.5
      return roundedRect(x, y, 1, 1, [
        !top && !left ? R : 0,
        !top && !right ? R : 0,
        !bottom && !right ? R : 0,
        !bottom && !left ? R : 0,
      ])
    }
    case 'bars-v':
    case 'bars-h':
      return '' // handled as runs
  }
}

export function layoutQr(model: QrModel, style: QrStyle, logo?: Pick<QrLogo, 'size' | 'excavate' | 'plate'> | null): QrGeometry {
  const {size, data} = model
  const m = Math.max(0, style.margin)

  // Logo box: odd module count keeps it centred on the grid.
  let logoBox: QrGeometry['logoBox'] = null
  let hole: {x0: number; y0: number; x1: number; y1: number} | null = null
  if (logo && logo.size > 0) {
    let w = Math.round(size * Math.min(0.32, Math.max(0.1, logo.size)))
    if (w % 2 !== size % 2) w += 1
    const start = (size - w) / 2
    const plate = logo.plate === 'none' ? 0 : 0.6
    logoBox = {x: start + m, y: start + m, w, h: w, plate}
    if (logo.excavate) {
      const pad = logo.plate === 'none' ? 0.5 : 0.35
      hole = {x0: start - pad, y0: start - pad, x1: start + w + pad, y1: start + w + pad}
    }
  }

  const dark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return false
    if (isFinderZone(x, y, size)) return false
    if (hole && x + 1 > hole.x0 && x < hole.x1 && y + 1 > hole.y0 && y < hole.y1) return false
    return data[y][x]
  }

  let dots = ''
  if (style.dots === 'square') {
    for (let y = 0; y < size; y++) {
      let x = 0
      while (x < size) {
        if (!dark(x, y)) {
          x++
          continue
        }
        let run = 1
        while (dark(x + run, y)) run++
        dots += `M${x + m} ${y + m}h${run}v1h${-run}Z`
        x += run
      }
    }
  } else if (style.dots === 'bars-v' || style.dots === 'bars-h') {
    const vertical = style.dots === 'bars-v'
    for (let a = 0; a < size; a++) {
      let b = 0
      while (b < size) {
        const at = (i: number) => (vertical ? dark(a, i) : dark(i, a))
        if (!at(b)) {
          b++
          continue
        }
        let run = 1
        while (b + run < size && at(b + run)) run++
        const inset = 0.12
        const r = 0.38
        dots += vertical
          ? roundedRect(a + m + inset, b + m + inset * 0.5, 1 - inset * 2, run - inset, [r, r, r, r])
          : roundedRect(b + m + inset * 0.5, a + m + inset, run - inset, 1 - inset * 2, [r, r, r, r])
        b += run
      }
    }
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!dark(x, y)) continue
        dots += dotPath(style.dots, x + m, y + m, (dx, dy) => dark(x + dx, y + dy))
      }
    }
  }

  const corners: Array<[number, number]> = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ]
  let eyeFrames = ''
  let eyeBalls = ''
  corners.forEach(([cx, cy], i) => {
    const x = cx + m
    const y = cy + m
    const inner = INNER_CORNER[i]
    // Ring = outer 7×7 minus inner 5×5 (fill-rule evenodd).
    eyeFrames += shapeBox(style.eyeFrame, x, y, 7, inner, false)
    eyeFrames += shapeBox(style.eyeFrame === 'cushion' ? 'rounded' : style.eyeFrame, x + 1, y + 1, 5, inner, false)
    eyeBalls += shapeBox(style.eyeBall, x + 2, y + 2, 3, inner, true)
  })

  return {total: size + m * 2, margin: m, size, dots, eyeFrames, eyeBalls, logoBox}
}

// ---------------------------------------------------------------------------
// Paint helpers
// ---------------------------------------------------------------------------

export interface PaintOptions {
  style: QrStyle
  logo?: QrLogo | null
  /** Pre-loaded logo image for canvas painting. */
  logoImage?: CanvasImageSource | null
  /** Unique id prefix for SVG gradient defs when several QR codes share a document. */
  idPrefix?: string
}

function gradientVector(rotation: number) {
  const rad = ((rotation % 360) * Math.PI) / 180
  const dx = Math.cos(rad) / 2
  const dy = Math.sin(rad) / 2
  return {x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy}
}

/**
 * SVG markup (no outer <svg>) for a QR placed at (x, y) with pixel width `px`.
 * Returns `{defs, body}` so callers can compose it into larger scenes.
 */
export function qrToSvgParts(geo: QrGeometry, x: number, y: number, px: number, opts: PaintOptions) {
  const {logo} = opts
  const style = normalizeStyle(opts.style)
  const id = opts.idPrefix ?? 'qv'
  const scale = px / geo.total
  let defs = ''
  let fill = style.fg
  if (style.gradient !== 'none') {
    const gid = `${id}-grad`
    // userSpaceOnUse (module units) so dots and eyes share one continuous gradient.
    const t = geo.total
    if (style.gradient === 'linear') {
      const v = gradientVector(style.gradientRotation)
      defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(v.x1 * t)}" y1="${f(v.y1 * t)}" x2="${f(v.x2 * t)}" y2="${f(v.y2 * t)}"><stop offset="0" stop-color="${esc(style.fg)}"/><stop offset="1" stop-color="${esc(style.fg2)}"/></linearGradient>`
    } else {
      defs += `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${f(t / 2)}" cy="${f(t / 2)}" r="${f(t * 0.7)}"><stop offset="0" stop-color="${esc(style.fg)}"/><stop offset="1" stop-color="${esc(style.fg2)}"/></radialGradient>`
    }
    fill = `url(#${gid})`
  }
  const frameFill = style.eyeFrameColor ?? fill
  const ballFill = style.eyeBallColor ?? fill
  let body = `<g transform="translate(${f(x)} ${f(y)}) scale(${f(scale)})">`
  if (!style.transparentBg) body += `<rect width="${geo.total}" height="${geo.total}" fill="${esc(style.bg)}"/>`
  body += `<path d="${geo.dots}" fill="${esc(fill)}"/>`
  body += `<path d="${geo.eyeFrames}" fill="${esc(frameFill)}" fill-rule="evenodd"/>`
  body += `<path d="${geo.eyeBalls}" fill="${esc(ballFill)}"/>`
  if (geo.logoBox && logo?.src) {
    const b = geo.logoBox
    if (logo.plate !== 'none') {
      const p = b.plate
      const r = logo.plate === 'circle' ? (b.w + p * 2) / 2 : logo.plate === 'rounded' ? (b.w + p * 2) * 0.22 : 0
      body += `<rect x="${f(b.x - p)}" y="${f(b.y - p)}" width="${f(b.w + p * 2)}" height="${f(b.h + p * 2)}" rx="${f(r)}" fill="${esc(logo.plateColor)}"/>`
    }
    const inset = logo.plate === 'circle' ? b.w * 0.14 : logo.plate === 'none' ? 0 : b.w * 0.04
    body += `<image href="${esc(logo.src)}" x="${f(b.x + inset)}" y="${f(b.y + inset)}" width="${f(b.w - inset * 2)}" height="${f(b.h - inset * 2)}" preserveAspectRatio="xMidYMid meet"/>`
  }
  body += '</g>'
  return {defs, body}
}

export function qrToSvg(geo: QrGeometry, px: number, opts: PaintOptions): string {
  const {defs, body} = qrToSvgParts(geo, 0, 0, px, opts)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" shape-rendering="${opts.style.dots === 'square' ? 'crispEdges' : 'geometricPrecision'}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
}

export function paintQr(
  ctx: CanvasRenderingContext2D,
  geo: QrGeometry,
  x: number,
  y: number,
  px: number,
  opts: PaintOptions,
) {
  const {logo, logoImage} = opts
  const style = normalizeStyle(opts.style)
  const scale = px / geo.total
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  if (!style.transparentBg) {
    ctx.fillStyle = style.bg
    ctx.fillRect(0, 0, geo.total, geo.total)
  }
  let fill: string | CanvasGradient = style.fg
  if (style.gradient === 'linear') {
    const v = gradientVector(style.gradientRotation)
    const g = ctx.createLinearGradient(v.x1 * geo.total, v.y1 * geo.total, v.x2 * geo.total, v.y2 * geo.total)
    g.addColorStop(0, style.fg)
    g.addColorStop(1, style.fg2)
    fill = g
  } else if (style.gradient === 'radial') {
    const c = geo.total / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, geo.total * 0.7)
    g.addColorStop(0, style.fg)
    g.addColorStop(1, style.fg2)
    fill = g
  }
  ctx.fillStyle = fill
  if (geo.dots) ctx.fill(new Path2D(geo.dots))
  ctx.fillStyle = style.eyeFrameColor ?? fill
  ctx.fill(new Path2D(geo.eyeFrames), 'evenodd')
  ctx.fillStyle = style.eyeBallColor ?? fill
  ctx.fill(new Path2D(geo.eyeBalls))
  if (geo.logoBox && logo && logoImage) {
    const b = geo.logoBox
    if (logo.plate !== 'none') {
      const p = b.plate
      const w = b.w + p * 2
      const r = logo.plate === 'circle' ? w / 2 : logo.plate === 'rounded' ? w * 0.22 : 0
      ctx.fillStyle = logo.plateColor
      ctx.beginPath()
      ctx.roundRect(b.x - p, b.y - p, w, w, r)
      ctx.fill()
    }
    const inset = logo.plate === 'circle' ? b.w * 0.14 : logo.plate === 'none' ? 0 : b.w * 0.04
    drawContain(ctx, logoImage, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2)
  }
  ctx.restore()
}

export function drawContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || w
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || h
  const s = Math.min(w / iw, h / ih)
  const dw = iw * s
  const dh = ih * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isValidColor(value: string | null | undefined): value is string {
  return Boolean(value && (HEX.test(value) || /^(rgb|hsl)a?\([\d\s.,%/+-]+\)$/i.test(value)))
}

/**
 * Invalid colours would render black in SVG but be ignored by canvas (blank
 * PNG) or throw in gradients — normalise once so both painters agree.
 */
export function normalizeStyle(style: QrStyle): QrStyle {
  const fg = isValidColor(style.fg) ? style.fg : DEFAULT_QR_STYLE.fg
  return {
    ...style,
    fg,
    fg2: isValidColor(style.fg2) ? style.fg2 : fg,
    bg: isValidColor(style.bg) ? style.bg : DEFAULT_QR_STYLE.bg,
    eyeFrameColor: isValidColor(style.eyeFrameColor) ? style.eyeFrameColor : null,
    eyeBallColor: isValidColor(style.eyeBallColor) ? style.eyeBallColor : null,
  }
}

export function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** WCAG relative luminance contrast between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(full.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
