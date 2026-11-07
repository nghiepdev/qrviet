import type {CSSProperties, ReactNode} from 'react'

/**
 * One hue per item (a tool, a feature, a template, a QR type), lighter in dark mode. Each sets
 * `--qv-hue`, which the badge, a `qv-tint` card and a `qv-tile-hue` tile (styles.css) colour
 * themselves from.
 */
export const HUES = {
  red: '[--qv-hue:#d7263d] dark:[--qv-hue:#f87171]',
  orange: '[--qv-hue:#ea580c] dark:[--qv-hue:#fb923c]',
  amber: '[--qv-hue:#d97706] dark:[--qv-hue:#fbbf24]',
  green: '[--qv-hue:#059669] dark:[--qv-hue:#34d399]',
  teal: '[--qv-hue:#0d9488] dark:[--qv-hue:#2dd4bf]',
  cyan: '[--qv-hue:#0891b2] dark:[--qv-hue:#22d3ee]',
  blue: '[--qv-hue:#2563eb] dark:[--qv-hue:#60a5fa]',
  indigo: '[--qv-hue:#4f46e5] dark:[--qv-hue:#818cf8]',
  violet: '[--qv-hue:#7c3aed] dark:[--qv-hue:#a78bfa]',
  pink: '[--qv-hue:#db2777] dark:[--qv-hue:#f472b6]',
  slate: '[--qv-hue:#475569] dark:[--qv-hue:#94a3b8]',
} as const

/** `--qv-heat` for step `i` of `count`: 0 at the cool end, 1 at the hot end (see `.qv-heat`). */
export function heatStyle(i: number, count: number): CSSProperties {
  return {'--qv-heat': count > 1 ? i / (count - 1) : 0} as CSSProperties
}

export type Hue = keyof typeof HUES

/** An icon on a soft square of its hue, for headings and cards. */
export function IconBadge({hue, children, className = ''}: {hue: Hue; children: ReactNode; className?: string}) {
  return (
    <span
      aria-hidden
      className={`${HUES[hue]} grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--qv-hue)_14%,transparent)] text-[var(--qv-hue)] ${className}`}>
      {children}
    </span>
  )
}
