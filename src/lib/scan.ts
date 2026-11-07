/**
 * QR decoding for camera frames and images. Uses the native BarcodeDetector
 * when it supports QR codes and falls back to jsQR (lazy-loaded, precached by
 * the service worker so it also works offline).
 */

type JsQR = typeof import('jsqr').default
let jsqrPromise: Promise<JsQR> | null = null
function loadJsQR(): Promise<JsQR> {
  jsqrPromise ??= import('jsqr').then((m) => m.default)
  return jsqrPromise
}

interface NativeDetector {
  detect(source: ImageBitmapSource): Promise<Array<{rawValue: string}>>
}
declare global {
  // eslint-disable-next-line no-var
  var BarcodeDetector:
    | {
        new (opts?: {formats: string[]}): NativeDetector
        getSupportedFormats(): Promise<string[]>
      }
    | undefined
}

let nativePromise: Promise<NativeDetector | null> | null = null
function getNativeDetector(): Promise<NativeDetector | null> {
  nativePromise ??= (async () => {
    try {
      if (!globalThis.BarcodeDetector) return null
      const formats = await globalThis.BarcodeDetector.getSupportedFormats()
      if (!formats.includes('qr_code')) return null
      return new globalThis.BarcodeDetector({formats: ['qr_code']})
    } catch {
      return null
    }
  })()
  return nativePromise
}

export type ScanEngine = 'native' | 'jsqr'
export async function preferredEngine(): Promise<ScanEngine> {
  return (await getNativeDetector()) ? 'native' : 'jsqr'
}

const work = typeof document !== 'undefined' ? document.createElement('canvas') : null

function toImageData(source: CanvasImageSource, width: number, height: number, maxSide = 1280): ImageData | null {
  if (!work) return null
  const scale = Math.min(1, maxSide / Math.max(width, height))
  work.width = Math.max(1, Math.round(width * scale))
  work.height = Math.max(1, Math.round(height * scale))
  const ctx = work.getContext('2d', {willReadFrequently: true})
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, work.width, work.height)
  return ctx.getImageData(0, 0, work.width, work.height)
}

/** Decode one frame/image. Returns every QR payload found (native may find several). */
export async function decodeSource(
  source: CanvasImageSource & ImageBitmapSource,
  width: number,
  height: number,
  opts: {thorough?: boolean} = {},
): Promise<string[]> {
  const native = await getNativeDetector()
  if (native) {
    try {
      const found = await native.detect(source)
      if (found.length) return found.map((f) => f.rawValue)
      if (!opts.thorough) return []
    } catch {
      /* fall through to jsQR */
    }
  }
  const jsQR = await loadJsQR()
  const sizes = opts.thorough ? [1280, 800, 1800, 520] : [960]
  for (const max of sizes) {
    const data = toImageData(source, width, height, max)
    if (!data) return []
    const res = jsQR(data.data, data.width, data.height, {inversionAttempts: opts.thorough ? 'attemptBoth' : 'dontInvert'})
    if (res?.data) return [res.data]
  }
  return []
}

export async function decodeBlob(blob: Blob): Promise<string[]> {
  const bitmap = await createImageBitmap(blob)
  try {
    return await decodeSource(bitmap, bitmap.width, bitmap.height, {thorough: true})
  } finally {
    bitmap.close()
  }
}

/** Verify that a rendered canvas decodes back to the expected payload. */
export async function verifyCanvas(canvas: HTMLCanvasElement, expected: string): Promise<boolean> {
  // Decoders read transparent pixels as black; check the code as it would look on paper.
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')
  if (!ctx) return false
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  const results = await decodeSource(flat, flat.width, flat.height, {thorough: true})
  return results.includes(expected)
}

/** Pull the first image out of a paste / drop event. */
export function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  for (const file of Array.from(dt.files ?? [])) if (file.type.startsWith('image/')) return file
  return null
}
