/**
 * PWA OS launch & share-target file bridge.
 *
 * - File Handlers (`file_handlers` in manifest.webmanifest): browsers deliver
 *   opened QR images via `window.launchQueue.setConsumer`.
 * - Web Share Target (`share_target` POST in src/sw.ts): the service worker
 *   caches the shared images under `/__share-target/<id>` and redirects to
 *   `/scan?shareId=<id>`; this module retrieves and deletes it.
 */
import {encodeRouteSearch} from './route-search'

export const SHARE_TARGET_CACHE = 'qrviet-share-target'

interface LaunchParamsLike {
  targetURL?: string
  files?: ReadonlyArray<{getFile(): Promise<File>}>
}

interface LaunchQueueLike {
  setConsumer(consumer: (params: LaunchParamsLike) => void | Promise<void>): void
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i

const pendingFiles: File[] = []
const listeners = new Set<() => void>()
let launchQueueInitialized = false

export function isImageFile(file: File): boolean {
  return file.size > 0 && (file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name))
}

export function enqueueLaunchFiles(files: File[]): void {
  if (!files.length) return
  pendingFiles.push(...files)
  listeners.forEach((fn) => fn())
}

export function consumeLaunchFiles(): File[] {
  if (!pendingFiles.length) return []
  return pendingFiles.splice(0, pendingFiles.length)
}

export function subscribeLaunchFiles(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Register the `window.launchQueue` consumer once at app startup. */
export function initLaunchQueue(onImageFiles: (failed: boolean) => void): void {
  if (typeof window === 'undefined' || launchQueueInitialized) return
  launchQueueInitialized = true
  const queue = (window as Window & {launchQueue?: LaunchQueueLike}).launchQueue
  if (!queue) return

  queue.setConsumer(async (params) => {
    if (!params.files?.length) return
    const results = await Promise.allSettled(params.files.map((handle) => handle.getFile()))
    const images = results.flatMap((result) =>
      result.status === 'fulfilled' && isImageFile(result.value) ? [result.value] : [],
    )
    enqueueLaunchFiles(images)
    onImageFiles(images.length !== results.length)
  })
}

function shareKey(shareId: string): URL {
  return new URL(`${import.meta.env.BASE_URL}__share-target/${shareId}`, location.origin)
}

export async function storeSharedFiles(files: File[]): Promise<string> {
  if (!files.length) throw new TypeError('No files to share')
  const shareId = `${Date.now()}-${crypto.randomUUID()}`
  const cache = await caches.open(SHARE_TARGET_CACHE)
  const cutoff = Date.now() - 5 * 60_000
  for (const request of await cache.keys()) {
    const timestamp = Number(new URL(request.url).pathname.split('/').pop()?.split('-')[0])
    if (timestamp > 0 && timestamp < cutoff) await cache.delete(request)
  }
  let response: Response
  if (files.length === 1) {
    // Existing clients can still read single-image shares while a worker update is waiting.
    response = new Response(files[0], {
      headers: {
        'content-type': files[0].type || 'application/octet-stream',
        'x-share-filename': encodeURIComponent(files[0].name || 'shared-qr.png'),
      },
    })
  } else {
    const data = new FormData()
    for (const file of files) data.append('media', file)
    response = new Response(data)
  }
  await cache.put(shareKey(shareId), response)
  return shareId
}

/** Consume the handoff only after every file has been read successfully. */
export async function consumeSharedFiles(shareId: string): Promise<File[]> {
  if (typeof caches === 'undefined' || !shareId) return []
  const cache = await caches.open(SHARE_TARGET_CACHE)
  const key = shareKey(shareId)
  const response = await cache.match(key)
  if (!response) return []
  let files: File[]
  if (response.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const data = await response.formData()
    files = data.getAll('media').filter((value): value is File => value instanceof File)
  } else {
    const blob = await response.blob()
    const rawName = response.headers.get('x-share-filename')
    files = [
      new File([blob], rawName ? decodeURIComponent(rawName) : 'shared-qr.png', {
        type: blob.type || 'image/png',
      }),
    ]
  }
  await cache.delete(key)
  return files
}

const textField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

export async function handleShareTarget(request: Request): Promise<Response> {
  const base = import.meta.env.BASE_URL
  let title = ''
  let text = ''
  let url = ''
  try {
    const data = await request.formData()
    title = textField(data.get('title'))
    text = textField(data.get('text'))
    url = textField(data.get('url'))
    const files = data
      .getAll('media')
      .filter((value): value is File => value instanceof File && isImageFile(value))
    const destination = new URL(`${base}${files.length ? 'scan' : 'open'}`, location.origin)
    if (files.length) destination.searchParams.set('shareId', await storeSharedFiles(files))
    else if (data.has('media')) throw new Error('No readable images')
    destination.hash = encodeRouteSearch({
      title: title || undefined,
      text: text || undefined,
      url: url || undefined,
      source: 'share',
    })
    return Response.redirect(destination.toString(), 303)
  } catch {
    const destination = new URL(`${base}scan`, location.origin)
    destination.searchParams.set('shareError', '1')
    destination.hash = encodeRouteSearch({
      title: title || undefined,
      text: text || undefined,
      url: url || undefined,
    })
    return Response.redirect(destination.toString(), 303)
  }
}
