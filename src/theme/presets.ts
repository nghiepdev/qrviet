/**
 * Theme recipes. A recipe is a small, serialisable description (base theme +
 * accent + shape + type) that we turn into an Astryx theme at runtime with
 * `defineTheme`, which is what Astryx recommends for in-browser theme editors.
 */
import {useSyncExternalStore} from 'react'
import {defineTheme, type DefinedTheme} from '@astryxdesign/core/theme'
import {neutralTheme} from '@astryxdesign/theme-neutral/built'
import {FONTS, MONO_STACK, type FontId} from './fonts'

export type BaseId = 'neutral' | 'butter' | 'chocolate' | 'matcha' | 'stone' | 'gothic' | 'y2k'
export type NeutralStyle = 'warm' | 'cool' | 'neutral'

export interface ThemeRecipe {
  id: string
  name: {vi: string; en: string}
  group: 'qrviet' | 'astryx' | 'custom'
  base: BaseId
  /** [light, dark]; omit to keep the base theme's own palette. */
  accent?: [string, string]
  onAccent?: [string, string]
  neutral?: NeutralStyle
  contrast?: 'standard' | 'high'
  /** Radius multiplier 0–2 (base 4px); omit to keep the base theme's shape. */
  radius?: number
  /** Body text size in px (14–17); omit to keep the base scale. */
  textSize?: number
  /** Theme-specific font; falls back to the global font preference. */
  font?: FontId
  /** Some bases (gothic) are designed dark-only. */
  forcedMode?: 'dark'
  /** Colours for the preview swatch. */
  swatches: string[]
}

const BASE_LOADERS: Record<BaseId, () => Promise<DefinedTheme>> = {
  neutral: () => Promise.resolve(neutralTheme),
  butter: () => import('@astryxdesign/theme-butter/built').then((m) => m.butterTheme),
  chocolate: () => import('@astryxdesign/theme-chocolate/built').then((m) => m.chocolateTheme),
  matcha: () => import('@astryxdesign/theme-matcha/built').then((m) => m.matchaTheme),
  stone: () => import('@astryxdesign/theme-stone/built').then((m) => m.stoneTheme),
  gothic: () => import('@astryxdesign/theme-gothic/built').then((m) => m.gothicTheme),
  y2k: () => import('@astryxdesign/theme-y2k/built').then((m) => m.y2kTheme),
}

const baseCache = new Map<BaseId, DefinedTheme>([['neutral', neutralTheme]])

const baseListeners = new Set<() => void>()

function subscribeBases(listener: () => void) {
  baseListeners.add(listener)
  return () => void baseListeners.delete(listener)
}

/** Downloads a base theme once; components reading it through `useLoadedBase` re-render when it lands. */
export async function loadBase(id: BaseId): Promise<DefinedTheme> {
  const hit = baseCache.get(id)
  if (hit) return hit
  const theme = await BASE_LOADERS[id]()
  baseCache.set(id, theme)
  baseListeners.forEach((listener) => listener())
  return theme
}

/**
 * The base theme if already downloaded, else undefined. The cache is external
 * mutable state, so it is read through useSyncExternalStore (never directly in
 * render, where the compiler would keep the first value).
 */
export function useLoadedBase(id: BaseId): DefinedTheme | undefined {
  return useSyncExternalStore(subscribeBases, () => baseCache.get(id))
}

export const BASE_IDS = Object.keys(BASE_LOADERS) as BaseId[]

export const PRESETS: ThemeRecipe[] = [
  {
    id: 'son',
    name: {vi: 'Đỏ son', en: 'Vermilion'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#D7263D', '#FF6B7B'],
    onAccent: ['#FFFFFF', '#2B0008'],
    neutral: 'warm',
    radius: 1.25,
    swatches: ['#D7263D', '#FFC93C', '#FFF4F2'],
  },
  {
    id: 'bien',
    name: {vi: 'Biển xanh', en: 'Ocean'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#1D63D8', '#7FB0FF'],
    onAccent: ['#FFFFFF', '#04193F'],
    neutral: 'cool',
    radius: 1.25,
    swatches: ['#1D63D8', '#38BDF8', '#F1F5FF'],
  },
  {
    id: 'ngoc',
    name: {vi: 'Ngọc bích', en: 'Jade'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#0B7F66', '#4FD1B0'],
    onAccent: ['#FFFFFF', '#00261D'],
    neutral: 'neutral',
    radius: 1.25,
    swatches: ['#0B7F66', '#A7F3D0', '#F0FBF7'],
  },
  {
    id: 'sen',
    name: {vi: 'Hoa sen', en: 'Lotus'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#C2185B', '#FF8AB8'],
    onAccent: ['#FFFFFF', '#3B0019'],
    neutral: 'warm',
    radius: 1.75,
    swatches: ['#C2185B', '#F9A8D4', '#FFF1F6'],
  },
  {
    id: 'hoang-hon',
    name: {vi: 'Hoàng hôn', en: 'Sunset'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#C2410C', '#FF9B5E'],
    onAccent: ['#FFFFFF', '#331000'],
    neutral: 'warm',
    radius: 1,
    swatches: ['#C2410C', '#FDBA74', '#FFF6EE'],
  },
  {
    id: 'tim-than',
    name: {vi: 'Tím than', en: 'Indigo night'},
    group: 'qrviet',
    base: 'neutral',
    accent: ['#4F46E5', '#A5A0FF'],
    onAccent: ['#FFFFFF', '#14104A'],
    neutral: 'cool',
    contrast: 'high',
    radius: 1.5,
    swatches: ['#4F46E5', '#C4B5FD', '#F3F2FF'],
  },
  {id: 'neutral', name: {vi: 'Neutral', en: 'Neutral'}, group: 'astryx', base: 'neutral', swatches: ['#1B1B1B', '#D4D4D4', '#F1F1F1']},
  {id: 'butter', name: {vi: 'Butter', en: 'Butter'}, group: 'astryx', base: 'butter', swatches: ['#F6C944', '#3B82F6', '#FFF8DC']},
  {id: 'chocolate', name: {vi: 'Chocolate', en: 'Chocolate'}, group: 'astryx', base: 'chocolate', swatches: ['#6B4226', '#D9B99B', '#F7EFE6']},
  {id: 'matcha', name: {vi: 'Matcha', en: 'Matcha'}, group: 'astryx', base: 'matcha', swatches: ['#4D7C3A', '#B5CFA0', '#F1F6EC']},
  {id: 'stone', name: {vi: 'Stone', en: 'Stone'}, group: 'astryx', base: 'stone', swatches: ['#57534E', '#A8A29E', '#F5F5F4']},
  {id: 'gothic', name: {vi: 'Gothic', en: 'Gothic'}, group: 'astryx', base: 'gothic', forcedMode: 'dark', swatches: ['#1E2533', '#8FA3BF', '#0B0F17']},
  {id: 'y2k', name: {vi: 'Y2K', en: 'Y2K'}, group: 'astryx', base: 'y2k', swatches: ['#8B9CFF', '#FF9DE2', '#EEF0FF']},
]

export const DEFAULT_THEME_ID = 'son'

export function findRecipe(id: string, custom: ThemeRecipe[]): ThemeRecipe {
  return custom.find((r) => r.id === id) ?? PRESETS.find((r) => r.id === id) ?? PRESETS[0]
}

/** Stable short hash so every distinct recipe gets its own theme name (CSS scope). */
function hash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

const themeCache = new Map<string, DefinedTheme>()

export function buildTheme(recipe: ThemeRecipe, base: DefinedTheme, globalFont: FontId): DefinedTheme {
  const font = FONTS[recipe.font ?? globalFont] ?? FONTS['be-vietnam']
  // The base is part of the identity: a temporary Neutral fallback (while a lazy base
  // loads) must never be cached under the final theme's name.
  const key = JSON.stringify([recipe, font.id, base.name])
  const name = `qv-${recipe.id}-${hash(key)}`
  const cached = themeCache.get(name)
  if (cached) return cached

  const tokens: Record<string, string | [string, string]> = {
    '--font-family-body': font.stack,
    '--font-family-heading': font.stack,
    '--font-family-code': MONO_STACK,
  }
  if (recipe.accent) tokens['--color-accent'] = recipe.accent
  if (recipe.onAccent) tokens['--color-on-accent'] = recipe.onAccent

  const theme = defineTheme({
    name,
    extends: base,
    ...(recipe.accent
      ? {color: {accent: recipe.accent, neutralStyle: recipe.neutral ?? 'neutral', contrast: recipe.contrast ?? 'standard'}}
      : {}),
    ...(recipe.radius !== undefined ? {radius: {base: 4, multiplier: recipe.radius}} : {}),
    ...(recipe.textSize ? {typography: {scale: {base: recipe.textSize, ratio: 1.2}}} : {}),
    tokens: tokens as never,
  })
  themeCache.set(name, theme)
  return theme
}

/** Accent swatches offered by the theme builder. */
export const ACCENT_CHOICES: Array<[string, string]> = [
  ['#D7263D', '#FF6B7B'],
  ['#E8590C', '#FFA36B'],
  ['#CA8A04', '#FACC15'],
  ['#15803D', '#5EE08F'],
  ['#0B7F66', '#4FD1B0'],
  ['#0E7490', '#4FD6F2'],
  ['#1D63D8', '#7FB0FF'],
  ['#4F46E5', '#A5A0FF'],
  ['#7C3AED', '#C4A1FF'],
  ['#C2185B', '#FF8AB8'],
  ['#334155', '#CBD5E1'],
]

/** Derive a lighter dark-mode partner for a custom accent. */
export function darkPartner(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.38)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
