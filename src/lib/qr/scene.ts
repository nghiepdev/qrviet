/**
 * Tiny vector "scene" used for card templates. One layout, two painters:
 * SVG (live preview + .svg export) and Canvas (PNG/JPEG/WebP export).
 */
import {
  esc,
  paintQr,
  qrToSvgParts,
  drawContain,
  type PaintOptions,
  type QrGeometry,
} from './render.ts'

export type Paint =
  | string
  | {type: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: Array<[number, string]>}

export type SceneNode =
  | {
      t: 'rect'
      x: number
      y: number
      w: number
      h: number
      r?: number
      fill?: Paint
      stroke?: string
      strokeWidth?: number
      dash?: number[]
    }
  | {
      t: 'text'
      x: number
      y: number
      text: string
      size: number
      weight?: number
      color: string
      align?: 'start' | 'middle' | 'end'
      letterSpacing?: number
      mono?: boolean
    }
  | {t: 'image'; x: number; y: number; w: number; h: number; src: string}
  | {t: 'qr'; x: number; y: number; size: number; geo: QrGeometry; opts: PaintOptions}
  | {
      t: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      color: string
      width: number
      dash?: number[]
    }
  | {t: 'path'; d: string; fill: Paint; opacity?: number}

export interface Scene {
  width: number
  height: number
  background?: Paint
  radius?: number
  fontFamily: string
  monoFamily: string
  nodes: SceneNode[]
}

export type Measure = (text: string, size: number, weight?: number, mono?: boolean) => number

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, {granularity: 'grapheme'})
    : null

function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
}

/** Replace lone surrogates so encodeURIComponent / XML never choke on user text. */
export function wellFormed(text: string): string {
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD',
  )
}

// ---------------------------------------------------------------------------
// Text fitting helpers (layout time)
// ---------------------------------------------------------------------------

/** Shrink font size until the text fits, then ellipsize as a last resort. */
export function fitText(
  measure: Measure,
  text: string,
  maxWidth: number,
  size: number,
  weight = 400,
  minSize = size * 0.7,
  mono = false,
): {text: string; size: number} {
  let s = size
  while (s > minSize && measure(text, s, weight, mono) > maxWidth) s -= 0.5
  if (measure(text, s, weight, mono) <= maxWidth) return {text, size: s}
  // Trim whole graphemes so emoji / combining marks are never split in half.
  const parts = graphemes(text)
  while (parts.length > 1 && measure(`${parts.join('')}…`, s, weight, mono) > maxWidth) parts.pop()
  return {text: `${parts.join('').trimEnd()}…`, size: s}
}

/** Greedy word wrap with a max line count (last line ellipsized). */
export function wrapText(
  measure: Measure,
  text: string,
  maxWidth: number,
  size: number,
  weight = 400,
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, size, weight) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines)
    return lines.map((l) => fitText(measure, l, maxWidth, size, weight, size).text)
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = fitText(
    measure,
    `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`,
    maxWidth,
    size,
    weight,
    size,
  ).text
  return kept
}

// ---------------------------------------------------------------------------
// SVG painter
// ---------------------------------------------------------------------------

function svgPaint(paint: Paint | undefined, defs: string[], id: string): string {
  if (!paint) return 'none'
  if (typeof paint === 'string') return esc(paint)
  const stops = paint.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${esc(c)}"/>`).join('')
  defs.push(
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${paint.x1}" y1="${paint.y1}" x2="${paint.x2}" y2="${paint.y2}">${stops}</linearGradient>`,
  )
  return `url(#${id})`
}

export function sceneToSvg(
  scene: Scene,
  opts: {idPrefix?: string; embedFontFace?: string} = {},
): string {
  const prefix = opts.idPrefix ?? 'qvs'
  const defs: string[] = []
  const body: string[] = []
  let n = 0
  const clipId = `${prefix}-clip`
  if (scene.radius) {
    defs.push(
      `<clipPath id="${clipId}"><rect width="${scene.width}" height="${scene.height}" rx="${scene.radius}"/></clipPath>`,
    )
  }
  if (scene.background) {
    body.push(
      `<rect width="${scene.width}" height="${scene.height}" rx="${scene.radius ?? 0}" fill="${svgPaint(scene.background, defs, `${prefix}-bg`)}"/>`,
    )
  }
  for (const node of scene.nodes) {
    n++
    switch (node.t) {
      case 'rect':
        body.push(
          `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.r ?? 0}" fill="${svgPaint(node.fill, defs, `${prefix}-g${n}`)}"${node.stroke ? ` stroke="${esc(node.stroke)}" stroke-width="${node.strokeWidth ?? 1}"` : ''}${node.dash ? ` stroke-dasharray="${node.dash.join(' ')}"` : ''}/>`,
        )
        break
      case 'text': {
        const anchor = node.align ?? 'start'
        body.push(
          `<text x="${node.x}" y="${node.y}" font-size="${node.size}" font-weight="${node.weight ?? 400}" fill="${esc(node.color)}" text-anchor="${anchor}"${node.letterSpacing ? ` letter-spacing="${node.letterSpacing}"` : ''}${node.mono ? ` font-family="${esc(scene.monoFamily)}"` : ''}>${escText(node.text)}</text>`,
        )
        break
      }
      case 'image':
        body.push(
          `<image href="${esc(node.src)}" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" preserveAspectRatio="xMidYMid meet"/>`,
        )
        break
      case 'qr': {
        const parts = qrToSvgParts(node.geo, node.x, node.y, node.size, {
          ...node.opts,
          idPrefix: `${prefix}-q${n}`,
        })
        if (parts.defs) defs.push(parts.defs)
        body.push(parts.body)
        break
      }
      case 'line':
        body.push(
          `<line x1="${node.x1}" y1="${node.y1}" x2="${node.x2}" y2="${node.y2}" stroke="${esc(node.color)}" stroke-width="${node.width}" stroke-linecap="round"${node.dash ? ` stroke-dasharray="${node.dash.join(' ')}"` : ''}/>`,
        )
        break
      case 'path':
        body.push(
          `<path d="${node.d}" fill="${svgPaint(node.fill, defs, `${prefix}-p${n}`)}"${node.opacity !== undefined ? ` opacity="${node.opacity}"` : ''}/>`,
        )
        break
    }
  }
  const style = `<style>${opts.embedFontFace ?? ''}text{font-family:${scene.fontFamily};}</style>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}">` +
    style +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    (scene.radius ? `<g clip-path="url(#${clipId})">${body.join('')}</g>` : body.join('')) +
    '</svg>'
  )
}

function escText(s: string): string {
  return wellFormed(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Canvas painter
// ---------------------------------------------------------------------------

function canvasPaint(ctx: CanvasRenderingContext2D, paint: Paint): string | CanvasGradient {
  if (typeof paint === 'string') return paint
  const g = ctx.createLinearGradient(paint.x1, paint.y1, paint.x2, paint.y2)
  for (const [o, c] of paint.stops) g.addColorStop(o, c)
  return g
}

export function collectImageSources(scene: Scene): string[] {
  const out = new Set<string>()
  for (const node of scene.nodes) {
    if (node.t === 'image') out.add(node.src)
    if (node.t === 'qr' && node.opts.logo?.src) out.add(node.opts.logo.src)
  }
  return [...out]
}

export function paintScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  images: Map<string, CanvasImageSource>,
  scale = 1,
) {
  ctx.save()
  ctx.scale(scale, scale)
  if (scene.radius) {
    ctx.beginPath()
    ctx.roundRect(0, 0, scene.width, scene.height, scene.radius)
    ctx.clip()
  }
  if (scene.background) {
    ctx.fillStyle = canvasPaint(ctx, scene.background)
    ctx.fillRect(0, 0, scene.width, scene.height)
  }
  for (const node of scene.nodes) {
    switch (node.t) {
      case 'rect': {
        ctx.beginPath()
        ctx.roundRect(node.x, node.y, node.w, node.h, node.r ?? 0)
        if (node.fill) {
          ctx.fillStyle = canvasPaint(ctx, node.fill)
          ctx.fill()
        }
        if (node.stroke) {
          ctx.strokeStyle = node.stroke
          ctx.lineWidth = node.strokeWidth ?? 1
          ctx.setLineDash(node.dash ?? [])
          ctx.stroke()
          ctx.setLineDash([])
        }
        break
      }
      case 'text': {
        ctx.font = `${node.weight ?? 400} ${node.size}px ${node.mono ? scene.monoFamily : scene.fontFamily}`
        ctx.fillStyle = node.color
        ctx.textAlign = node.align === 'middle' ? 'center' : node.align === 'end' ? 'right' : 'left'
        ctx.textBaseline = 'alphabetic'
        if (node.letterSpacing && 'letterSpacing' in ctx) {
          ;(ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing =
            `${node.letterSpacing}px`
        }
        ctx.fillText(node.text, node.x, node.y)
        if ('letterSpacing' in ctx)
          (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = '0px'
        break
      }
      case 'image': {
        const img = images.get(node.src)
        if (img) drawContain(ctx, img, node.x, node.y, node.w, node.h)
        break
      }
      case 'qr':
        paintQr(ctx, node.geo, node.x, node.y, node.size, {
          ...node.opts,
          logoImage: node.opts.logo?.src ? images.get(node.opts.logo.src) : null,
        })
        break
      case 'line':
        ctx.beginPath()
        ctx.moveTo(node.x1, node.y1)
        ctx.lineTo(node.x2, node.y2)
        ctx.strokeStyle = node.color
        ctx.lineWidth = node.width
        ctx.lineCap = 'round'
        ctx.setLineDash(node.dash ?? [])
        ctx.stroke()
        ctx.setLineDash([])
        break
      case 'path':
        ctx.save()
        if (node.opacity !== undefined) ctx.globalAlpha = node.opacity
        ctx.fillStyle = canvasPaint(ctx, node.fill)
        ctx.fill(new Path2D(node.d))
        ctx.restore()
        break
    }
  }
  ctx.restore()
}
