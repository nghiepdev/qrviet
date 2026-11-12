import type {HistoryItem} from '#/stores/history'
import {DEFAULT_DESIGN, settingsStore} from '#/stores/settings'
import {parseEmvQr} from '#/lib/vietqr'
import {EMPTY_FORM, draftStore, formFromParsed, type VietQrForm} from './form'

/**
 * The generator form a history entry reopens: the one saved with it, or for older entries and scans
 * one rebuilt from the payload. Null when the payload is not a VietQR.
 */
function historyForm(h: HistoryItem): VietQrForm | null {
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

/**
 * Loads an entry before navigation, and on direct visits to its URL.
 * Entries without a saved design use defaults; their original design cannot be recovered.
 * Uploaded logos stay in settings because history omits their image data.
 */
export function applyHistoryEntry(h: HistoryItem): boolean {
  const form = historyForm(h)
  if (!form) return false
  draftStore.setState(() => form)
  settingsStore.setState((s) => ({
    ...s,
    design: {...(h.design ?? DEFAULT_DESIGN), customLogo: s.design.customLogo},
  }))
  return true
}
