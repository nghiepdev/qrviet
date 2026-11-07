import {Compass} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {useT} from '#/i18n'

/** "Page not found", for the catch-all route and anything that throws notFound(). */
export function NotFound() {
  const t = useT()
  return (
    <div className="p-6 lg:p-12">
      <EmptyState
        icon={<Compass size={40} aria-hidden />}
        headingLevel={1}
        title={t('app.notFound')}
        description={t('app.notFoundBody')}
        actions={<Button label={t('app.goHome')} variant="primary" href="/" />}
      />
    </div>
  )
}
