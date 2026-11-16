import {useSelector} from '@tanstack/react-store'
import {persistedStore} from '#/lib/persist'
import {uid} from '#/lib/text'
import type {VietQrForm} from '#/components/vietqr/form'
import type {QrDesign} from './settings'

export type HistoryKind = 'vietqr' | 'qr' | 'scan'

export interface HistoryItem {
  id: string
  kind: HistoryKind
  payload: string
  title: string
  subtitle: string
  meta: {
    bin?: string
    accountNumber?: string
    accountName?: string
    amount?: string
    purpose?: string
    qrType?: string
  }
  pinned: boolean
  createdAt: number
  /** An image of the exported code is stored for it (src/lib/thumbs.ts). */
  thumb?: boolean
  /**
   * VietQR entries made by the generator: the form and design they were exported with, so opening
   * the entry shows that very code again (src/components/vietqr/history-entry.ts). Older entries,
   * and scans, have neither. The design leaves out the uploaded logo image (`customLogo: null`):
   * one copy per entry would soon fill the storage quota.
   */
  form?: VietQrForm
  design?: QrDesign
}

const MAX_ITEMS = 300

export const historyStore = persistedStore<HistoryItem[]>({key: 'history', version: 1, initial: []})

export function useHistory<T = HistoryItem[]>(selector?: (h: HistoryItem[]) => T): T {
  return useSelector(historyStore, selector ?? ((h) => h as unknown as T))
}

/** Add an entry; identical payloads of the same kind are moved to the top instead of duplicated. */
export function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt' | 'pinned'>): HistoryItem {
  const existing = historyStore.state.find(
    (h) => h.kind === item.kind && h.payload === item.payload,
  )
  const record: HistoryItem = {
    ...item,
    id: existing?.id ?? uid(),
    pinned: existing?.pinned ?? false,
    createdAt: Date.now(),
  }
  historyStore.setState((list) => {
    const next = [record, ...list.filter((h) => h.id !== record.id)]
    if (next.length <= MAX_ITEMS) return next
    // Trim the oldest unpinned entries.
    const pinned = next.filter((h) => h.pinned)
    const rest = next.filter((h) => !h.pinned).slice(0, Math.max(0, MAX_ITEMS - pinned.length))
    return next.filter((h) => h.pinned || rest.includes(h))
  })
  return record
}

export function removeHistory(id: string): HistoryItem | undefined {
  const target = historyStore.state.find((h) => h.id === id)
  historyStore.setState((list) => list.filter((h) => h.id !== id))
  return target
}

export function restoreHistory(item: HistoryItem) {
  historyStore.setState((list) =>
    list.some((h) => h.id === item.id)
      ? list
      : [...list, item].sort((a, b) => b.createdAt - a.createdAt),
  )
}

export function togglePin(id: string) {
  historyStore.setState((list) => list.map((h) => (h.id === id ? {...h, pinned: !h.pinned} : h)))
}

export function clearHistory() {
  historyStore.setState((list) => list.filter((h) => h.pinned))
}
