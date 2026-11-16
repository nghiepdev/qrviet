/** Browser-side export helpers: canvas raster, downloads, clipboard, share, print. */
import {collectImageSources, paintScene, sceneToSvg, type Measure, type Scene} from './scene.ts'
import {FONT_STACK, MONO_STACK} from './templates.ts'

let measureCtx: CanvasRenderingContext2D | null = null

export function createMeasure(): Measure {
  return (text, size, weight = 400, mono = false) => {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
    if (!measureCtx) return text.length * size * 0.55
    measureCtx.font = `${weight} ${size}px ${mono ? MONO_STACK : FONT_STACK}`
    return measureCtx.measureText(text).width
  }
}

let fontsReady: Promise<unknown> | null = null
/** Make sure the export font is decoded before painting on canvas. */
export function ensureExportFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve()
  fontsReady ??= Promise.all(
    [400, 500, 600, 700, 800].map((w) =>
      document.fonts.load(`${w} 16px "Be Vietnam Pro"`, 'Việt Nam ₫ 0123'),
    ),
  ).catch(() => undefined)
  return fontsReady
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        imageCache.delete(src)
        reject(new Error(`Cannot load image ${src}`))
      }
      img.src = src
    })
    imageCache.set(src, p)
  }
  return p
}

export async function renderSceneToCanvas(scene: Scene, scale = 2): Promise<HTMLCanvasElement> {
  await ensureExportFonts()
  const sources = collectImageSources(scene)
  const images = new Map<string, CanvasImageSource>()
  await Promise.all(
    sources.map(async (src) => {
      try {
        images.set(src, await loadImage(src))
      } catch {
        // Missing logos are skipped rather than failing the export.
      }
    }),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scene.width * scale)
  canvas.height = Math.round(scene.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.imageSmoothingQuality = 'high'
  paintScene(ctx, scene, images, scale)
  return canvas
}

export type RasterType = 'image/png' | 'image/jpeg' | 'image/webp'

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: RasterType = 'image/png',
  quality = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (type === 'image/jpeg') {
      // JPEG has no alpha: flatten onto white first.
      const flat = document.createElement('canvas')
      flat.width = canvas.width
      flat.height = canvas.height
      const ctx = flat.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, flat.width, flat.height)
      ctx.drawImage(canvas, 0, 0)
      canvas = flat
    }
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality)
  })
}

const dataUrlCache = new Map<string, Promise<string>>()
function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return Promise.resolve(src)
  let p = dataUrlCache.get(src)
  if (!p) {
    p = fetch(src)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () =>
              typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('Image encoding failed'))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          }),
      )
    p.catch(() => dataUrlCache.delete(src))
    dataUrlCache.set(src, p)
  }
  return p
}

/**
 * Standalone SVG: inline every image so the file renders anywhere — including
 * inside <img> data URLs (print, HTML embeds), which cannot load external files.
 */
export async function sceneToStandaloneSvg(scene: Scene): Promise<string> {
  const inlined: Scene = {
    ...scene,
    nodes: await Promise.all(
      scene.nodes.map(async (node) => {
        try {
          if (node.t === 'image') return {...node, src: await toDataUrl(node.src)}
          if (node.t === 'qr' && node.opts.logo?.src) {
            return {
              ...node,
              opts: {
                ...node.opts,
                logo: {...node.opts.logo, src: await toDataUrl(node.opts.logo.src)},
              },
            }
          }
        } catch {
          /* keep original reference */
        }
        return node
      }),
    ),
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${sceneToSvg(inlined, {idPrefix: 'qrviet'})}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], {type}), filename)
}

export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
}

/** Pass a pending blob so Safari keeps the user-gesture context. */
export async function copyImage(blob: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({'image/png': blob})])
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob(['x'], {type: 'image/png'})], 'probe.png', {type: 'image/png'})
    return typeof navigator.canShare === 'function' && navigator.canShare({files: [probe]})
  } catch {
    return false
  }
}

export async function shareFile(
  file: File,
  text?: string,
  title?: string,
): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({files: [file], text, title})
    return 'shared'
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
    throw e
  }
}

export async function shareLink(
  url: string,
  text?: string,
  title?: string,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator.share !== 'function') return 'unsupported'
  try {
    await navigator.share({url, text, title})
    return 'shared'
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
    throw e
  }
}

export interface PrintOptions {
  /** CSS page size, e.g. 'A4', 'A5', 'A6', '100mm 150mm'. */
  page?: string
  columns?: number
  gapMm?: number
  marginMm?: number
  /** Width of each item in mm (defaults to fill the column). */
  itemWidthMm?: number
  title?: string
}

/** Print SVG markup through a hidden iframe (works inside installed PWAs). */
export function printSvgs(svgs: string[], opts: PrintOptions = {}): Promise<void> {
  const {page = 'A4', columns = 1, gapMm = 6, marginMm = 10, itemWidthMm, title = 'QRViet'} = opts
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument!
    const items = svgs
      .map(
        (svg) =>
          `<div class="item"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt=""/></div>`,
      )
      .join('')
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      @page { size: ${page}; margin: ${marginMm}mm; }
      html,body { margin:0; padding:0; background:#fff; }
      .grid { display:grid; grid-template-columns: repeat(${columns}, 1fr); gap:${gapMm}mm; justify-items:center; align-items:start; }
      .item { break-inside: avoid; width: ${itemWidthMm ? `${itemWidthMm}mm` : '100%'}; }
      .item img { width:100%; height:auto; display:block; }
    </style></head><body><div class="grid">${items}</div></body></html>`)
    doc.close()
    const images = Array.from(doc.images)
    Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    )
      .then(() => ensureExportFonts())
      .then(() => {
        const win = iframe.contentWindow!
        const cleanup = () => {
          setTimeout(() => iframe.remove(), 500)
          resolve()
        }
        win.addEventListener('afterprint', cleanup, {once: true})
        win.focus()
        win.print()
        // Some browsers don't fire afterprint on the iframe.
        setTimeout(cleanup, 60_000)
      })
      .catch((error: unknown) => {
        iframe.remove()
        reject(error)
      })
  })
}

/** "data:image/svg+xml" URL for embedding (HTML/Markdown snippets). */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
