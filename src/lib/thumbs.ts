/**
 * Small images of exported codes for the history list, so an entry shows what was actually made
 * (template, colours, logo) rather than a plain redraw of its payload. They live in IndexedDB, keyed
 * by history entry id, outside the persisted history JSON that is rewritten on every change.
 */
import type {Scene} from '#/lib/qr/scene'
import {canvasToBlob, renderSceneToCanvas} from '#/lib/qr/export'

const DB_NAME = 'qrviet'
const STORE = 'thumbs'
/** Longest side of a stored image: 3× the 64 px the list shows it at. */
const THUMB_PX = 192

let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return opening
}

async function request<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Render `scene` small and store it for history entry `id`. Failures only cost the preview. */
export async function saveSceneThumb(id: string, scene: Scene): Promise<void> {
  try {
    const canvas = await renderSceneToCanvas(scene, THUMB_PX / Math.max(scene.width, scene.height))
    const blob = await canvasToBlob(canvas, 'image/webp', 0.85)
    await request('readwrite', (store) => store.put(blob, id))
  } catch {
    // The list draws the bare code instead.
  }
}

export async function loadThumb(id: string): Promise<Blob | null> {
  try {
    return (await request<Blob | undefined>('readonly', (store) => store.get(id))) ?? null
  } catch {
    return null
  }
}

/**
 * Drop the images of entries that are gone (deleted, cleared, trimmed). Run at startup rather than
 * on delete, so undoing a deletion gets its image back.
 */
export async function pruneThumbs(keepIds: Iterable<string>): Promise<void> {
  try {
    const keep = new Set(keepIds)
    const keys = await request('readonly', (store) => store.getAllKeys())
    const stale = keys.filter((key) => typeof key !== 'string' || !keep.has(key))
    await Promise.all(stale.map((key) => request('readwrite', (store) => store.delete(key))))
  } catch {
    // Nothing to tidy, or no IndexedDB.
  }
}

/** Delete every stored image (the "wipe all data" setting). */
export async function clearThumbs(): Promise<void> {
  try {
    if (opening) (await opening).close()
  } catch {
    // Never opened.
  }
  opening = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}
