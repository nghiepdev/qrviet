/**
 * Font choices. Every option supports the full Vietnamese character set and is
 * self-hosted (bundled + precached), so typography survives offline mode.
 */
export type FontId = 'be-vietnam' | 'inter' | 'nunito' | 'system'

export interface FontOption {
  id: FontId
  label: string
  sample: string
  stack: string
  load: () => Promise<unknown>
}

const SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const FONTS: Record<FontId, FontOption> = {
  'be-vietnam': {
    id: 'be-vietnam',
    label: 'Be Vietnam Pro',
    sample: 'Chuyển khoản nhanh',
    stack: `"Be Vietnam Pro", ${SYSTEM}`,
    load: () => Promise.resolve(), // imported eagerly in main.tsx (brand font)
  },
  inter: {
    id: 'inter',
    label: 'Inter',
    sample: 'Chuyển khoản nhanh',
    stack: `"Inter Variable", ${SYSTEM}`,
    load: () => import('@fontsource-variable/inter'),
  },
  nunito: {
    id: 'nunito',
    label: 'Nunito',
    sample: 'Chuyển khoản nhanh',
    stack: `"Nunito Variable", ${SYSTEM}`,
    load: () => import('@fontsource-variable/nunito'),
  },
  system: {
    id: 'system',
    label: 'System',
    sample: 'Chuyển khoản nhanh',
    stack: SYSTEM,
    load: () => Promise.resolve(),
  },
}

export const FONT_IDS = Object.keys(FONTS) as FontId[]
export const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace'
