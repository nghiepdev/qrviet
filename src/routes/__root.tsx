import {Outlet, createRootRoute, useRouter, type ErrorComponentProps} from '@tanstack/react-router'
import {Button} from '@astryxdesign/core/Button'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {Compass, TriangleAlert} from 'lucide-react'
import {AppProviders} from '#/app/AppProviders'
import {AppLayout} from '#/components/layout/AppLayout'
import {useT} from '#/i18n'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
})

function RootComponent() {
  return (
    <AppProviders>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AppProviders>
  )
}

function NotFound() {
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

function ErrorView({error, reset}: ErrorComponentProps) {
  const t = useT()
  const router = useRouter()
  return (
    <div className="p-6 lg:p-12">
      <EmptyState
        icon={<TriangleAlert size={40} aria-hidden />}
        headingLevel={1}
        title={t('app.error')}
        description={`${t('app.errorBody')} ${import.meta.env.DEV ? `(${(error as Error)?.message})` : ''}`}
        actions={
          <Button
            label={t('app.reload')}
            variant="primary"
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          />
        }
      />
    </div>
  )
}
