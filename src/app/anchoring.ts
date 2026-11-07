/**
 * Astryx places every layer that hangs off a control (menus, option lists, tooltips, the carousel's
 * prev/next buttons) with CSS anchor positioning, which Safari has only from version 26. Without
 * it (iOS 18 and older), such a layer shows up in the top-left corner of the screen instead of by
 * its control. Callers then use a surface that needs no anchor: a bottom sheet for menus and option
 * lists, the browser's own date pickers, and no carousel buttons (swipe, trackpad and keyboard still
 * scroll). Tooltips are hidden by a rule in styles.css.
 */
export const canAnchor = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('anchor-name', '--qv')

/** `presentation` for date and time inputs: Astryx's own calendar where it can be anchored, the browser's pickers otherwise. */
export const datePickerPresentation = canAnchor ? ('adaptive-native' as const) : ('native' as const)

/** `presentation` for a menu or option list where layers can be anchored, a bottom sheet otherwise. */
export function sheetUnlessAnchored<T extends 'popover' | 'adaptive'>(presentation: T): T | 'bottom-sheet' {
  return canAnchor ? presentation : 'bottom-sheet'
}
