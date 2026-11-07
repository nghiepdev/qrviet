import {useEffect, useRef} from 'react'
import {annotate, annotationGroup} from 'rough-notation'
import type {RoughAnnotationConfig} from 'rough-notation/lib/model'

export type MarkStyle = Pick<RoughAnnotationConfig, 'type' | 'multiline' | 'padding' | 'strokeWidth' | 'iterations' | 'animationDuration'>

/**
 * Text whose `*marked*` parts get hand-drawn Rough Notation marks, drawn one after another.
 * The n-th marked part uses `marks[n]` (pass a module-level constant). The library draws with
 * currentColor, and styles.css colours each mark from its type (`[data-rough]`), so marks follow
 * the theme. With reduced motion the marks appear without being drawn.
 */
export function MarkedText({text, marks}: {text: string; marks: readonly MarkStyle[]}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const annotations = [...root.querySelectorAll<HTMLElement>('[data-rough]')].map((el, i) => annotate(el, {...marks[i % marks.length], animate: !still}))
    const timer = window.setTimeout(() => annotationGroup(annotations).show(), still ? 0 : 400)
    return () => {
      window.clearTimeout(timer)
      for (const annotation of annotations) annotation.remove()
    }
  }, [text, marks])

  return (
    <span ref={ref}>
      {text.split('*').map((part, i) =>
        i % 2 ? (
          <span key={i} data-rough={marks[((i - 1) / 2) % marks.length].type}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  )
}
