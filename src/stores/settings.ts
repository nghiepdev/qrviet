import {useSelector} from '@tanstack/react-store'
import {persistedStore} from '#/lib/persist'
import {DEFAULT_QR_STYLE, type QrStyle, type LogoPlate} from '#/lib/qr/render'
import type {TemplateId} from '#/lib/qr/templates'
import type {ContentMode} from '#/lib/text'
import type {FontId} from '#/theme/fonts'
import {DEFAULT_THEME_ID, type ThemeRecipe} from '#/theme/presets'

export type ColorMode = 'system' | 'light' | 'dark'
export type Locale = 'vi' | 'en'
export type LogoMode = 'none' | 'bank' | 'brand' | 'custom'

export interface QrDesign {
  template: TemplateId
  accent: string
  style: QrStyle
  logoMode: LogoMode
  customLogo: string | null
  logoSize: number
  logoPlate: LogoPlate
  showBrand: boolean
  maskAccount: boolean
  title: string
}

export interface Settings {
  locale: Locale
  mode: ColorMode
  themeId: string
  customThemes: ThemeRecipe[]
  font: FontId
  design: QrDesign
  contentMode: ContentMode
  favoriteBins: string[]
  recentBins: string[]
  autoSaveHistory: boolean
  installDismissedAt: number | null
}

export const DEFAULT_DESIGN: QrDesign = {
  template: 'compact',
  accent: '#d7263d',
  style: {...DEFAULT_QR_STYLE, ecc: 'M', margin: 2},
  logoMode: 'none',
  customLogo: null,
  logoSize: 0.22,
  logoPlate: 'rounded',
  showBrand: true,
  maskAccount: false,
  title: '',
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'vi', // Vietnamese is the default product language
  mode: 'system',
  themeId: DEFAULT_THEME_ID,
  customThemes: [],
  font: 'be-vietnam',
  design: DEFAULT_DESIGN,
  contentMode: 'relaxed',
  favoriteBins: [],
  recentBins: [],
  autoSaveHistory: true,
  installDismissedAt: null,
}

export const settingsStore = persistedStore<Settings>({
  key: 'settings',
  version: 1,
  initial: DEFAULT_SETTINGS,
  merge: (p, init) => ({
    ...init,
    ...p,
    design: {...init.design, ...p.design, style: {...init.design.style, ...p.design?.style}},
  }),
})

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useSelector(settingsStore, selector)
}

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  settingsStore.setState((s) => ({...s, ...(typeof patch === 'function' ? patch(s) : patch)}))
}

export function updateDesign(patch: Partial<QrDesign>) {
  settingsStore.setState((s) => ({...s, design: {...s.design, ...patch}}))
}

export function updateQrStyle(patch: Partial<QrStyle>) {
  settingsStore.setState((s) => ({...s, design: {...s.design, style: {...s.design.style, ...patch}}}))
}

export function toggleFavoriteBank(bin: string) {
  settingsStore.setState((s) => ({
    ...s,
    favoriteBins: s.favoriteBins.includes(bin) ? s.favoriteBins.filter((b) => b !== bin) : [bin, ...s.favoriteBins],
  }))
}

export function pushRecentBank(bin: string) {
  settingsStore.setState((s) => ({...s, recentBins: [bin, ...s.recentBins.filter((b) => b !== bin)].slice(0, 6)}))
}

export function cycleMode() {
  settingsStore.setState((s) => {
    const prefersDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    const effective = s.mode === 'system' ? (prefersDark ? 'dark' : 'light') : s.mode
    return {...s, mode: effective === 'dark' ? 'light' : 'dark'}
  })
}
