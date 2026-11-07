import type {ReactNode} from 'react'
import type {LucideIcon} from 'lucide-react'
import {Heading} from '@astryxdesign/core/Heading'
import {Text} from '@astryxdesign/core/Text'
import {IconBadge, HUES, type Hue} from './icon-badge'

export function PageHeader({title, subtitle, icon, actions}: {title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode}) {
  return (
    <header className="qv-hero px-4 pt-4 pb-4 sm:pt-6 sm:pb-5 md:px-6 lg:px-8 lg:pt-8 lg:pb-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 animate-qv-rise">
          {icon && (
            <span className="hidden sm:grid place-items-center size-11 rounded-lg bg-accent text-on-accent shadow-md shrink-0" aria-hidden>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <Heading level={1}>{title}</Heading>
            {subtitle && (
              <div className="mt-1 max-w-2xl text-sm sm:text-base">
                <Text type="inherit" color="secondary">
                  {subtitle}
                </Text>
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}

export function PageBody({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pb-8 ${className}`}>{children}</div>
}

/**
 * Card section, used across pages: washed with `hue` at the top (the look of /tools), with an
 * optional title row. With an `icon` too, the title gets it on a badge in the same hue.
 */
export function Panel({
  title,
  description,
  icon: Icon,
  hue = 'red',
  actions,
  id,
  children,
  className = '',
}: {
  title?: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  hue?: Hue
  actions?: ReactNode
  /** Anchor to scroll to; the card then leaves room for the sticky top bar. */
  id?: string
  children: ReactNode
  className?: string
}) {
  const badge = Boolean(Icon && title)
  return (
    <section
      id={id}
      className={`${HUES[hue]} qv-tint rounded-xl border border-border p-4 sm:p-5 shadow-sm ${id ? 'scroll-mt-24' : ''} ${className}`}>
      {(title || actions) && (
        <div className={`flex justify-between gap-3 mb-4 ${badge && !description ? 'items-center' : 'items-start'}`}>
          {badge && Icon && (
            <IconBadge hue={hue}>
              <Icon size={20} />
            </IconBadge>
          )}
          <div className="min-w-0 flex-1">
            {title && <Heading level={2} type={undefined}>{title}</Heading>}
            {description && (
              <div className="mt-0.5">
                <Text type="supporting" color="secondary">
                  {description}
                </Text>
              </div>
            )}
          </div>
          {actions && <div className="flex gap-1 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
