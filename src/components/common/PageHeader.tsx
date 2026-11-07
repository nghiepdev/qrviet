import type {ReactNode} from 'react'
import {Heading} from '@astryxdesign/core/Heading'
import {Text} from '@astryxdesign/core/Text'

export function PageHeader({title, subtitle, icon, actions}: {title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode}) {
  return (
    <header className="qv-hero px-4 pt-4 pb-4 sm:pt-6 sm:pb-5 lg:px-8 lg:pt-8 lg:pb-6">
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
  return <div className={`mx-auto max-w-6xl px-4 lg:px-8 pb-8 ${className}`}>{children}</div>
}

/** Card section with a title row — used across tool pages. */
export function Panel({title, description, actions, children, className = ''}: {title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string}) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
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
