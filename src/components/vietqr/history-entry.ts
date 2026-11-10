import {historyStore, type HistoryItem} from '#/stores/history'
import {settingsStore, type QrDesign} from '#/stores/settings'
import {parseEmvQr} from '#/lib/vietqr'
import {EMPTY_FORM, draftStore, formFromParsed, type VietQrForm} from './form'

/**
 * The generator form a history entry reopens: the one saved with it, or for older entries and scans
 * one rebuilt from the payload. Null when the payload is not a VietQR.
 */
export function historyForm(h: HistoryItem): VietQrForm | null {
  if (h.form) return {...EMPTY_FORM, ...h.form}
  try {
    const p = parseEmvQr(h.payload)
    if (p.kind !== 'vietqr') return null
    const form = formFromParsed(p)
    return {...form, accountName: h.meta.accountName || form.accountName}
  } catch {
    return null
  }
}

/** The design to keep with a new entry: the current one without the uploaded logo image. */
export function historyDesign(design: QrDesign): QrDesign {
  return {...design, style: {...design.style}, customLogo: null}
}

export function findHistoryEntry(id: string | undefined): HistoryItem | undefined {
  return id ? historyStore.state.find((h) => h.id === id) : undefined
}

/**
 * Puts a history entry into the generator: its form, and its design when it has one (entries
 * without keep the current design). The uploaded logo is not stored per entry, so the current one
 * stands in for it. Returns false when the entry is not a VietQR the generator can show.
 *
 * Called before navigating to the generator, so its first frame already shows the entry instead of
 * the previous draft, and again by the generator when it is opened at the entry's URL directly.
 */
export function applyHistoryEntry(h: HistoryItem): boolean {
  const form = historyForm(h)
  if (!form) return false
  draftStore.setState(() => form)
  const {design} = h
  if (design) {
    settingsStore.setState((s) => ({
      ...s,
      design: {...s.design, ...design, style: {...s.design.style, ...design.style}, customLogo: s.design.customLogo},
    }))
  }
  return true
}
