import {useCallback} from 'react'

/**
 * Masonry for a CSS grid of cards (its columns and gap stay in its classes): a card no longer waits
 * for the tallest card of the row above, it rises into the space under the card above it.
 *
 * Where the browser has native grid lanes (`display: grid-lanes`, Safari 26.4+) it lays the cards out
 * itself. Elsewhere the grid gets 1px rows with no row gap, and each card spans as many rows as its
 * height plus the gap, kept up to date as cards change size. Cards keep their order; a one-column
 * grid simply stacks them as before.
 */
export function useMasonry<T extends HTMLElement>() {
  return useCallback((grid: T | null) => {
    if (!grid) return
    if (CSS.supports('display', 'grid-lanes')) {
      grid.style.display = 'grid-lanes'
      return () => grid.style.removeProperty('display')
    }
    const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0
    grid.style.gridAutoRows = '1px'
    grid.style.rowGap = '0px'
    grid.style.alignItems = 'start'
    const span = (card: Element) => {
      if (card instanceof HTMLElement)
        card.style.gridRowEnd = `span ${Math.round(card.getBoundingClientRect().height + gap)}`
    }
    const resize = new ResizeObserver((entries) => entries.forEach((entry) => span(entry.target)))
    const watch = () => {
      for (const card of grid.children) {
        resize.observe(card)
        span(card)
      }
    }
    // Cards that mount later (a panel shown on demand) join in too.
    const children = new MutationObserver(watch)
    children.observe(grid, {childList: true})
    watch()
    return () => {
      children.disconnect()
      resize.disconnect()
      for (const card of grid.children)
        if (card instanceof HTMLElement) card.style.removeProperty('grid-row-end')
      for (const prop of ['grid-auto-rows', 'row-gap', 'align-items'])
        grid.style.removeProperty(prop)
    }
  }, [])
}
