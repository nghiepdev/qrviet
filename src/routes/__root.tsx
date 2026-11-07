import type {ReactNode} from 'react'
import {ClientOnly, HeadContent, Outlet, Scripts, createRootRoute, useRouter, type ErrorComponentProps} from '@tanstack/react-router'
import {Button} from '@astryxdesign/core/Button'
import {EmptyState} from '@astryxdesign/core/EmptyState'
import {TriangleAlert} from 'lucide-react'
import {AppProviders} from '#/app/app-providers'
import {BOOT_CSS, BOOT_HTML, PREPAINT_SCRIPT} from '#/app/boot-splash'
import {splashVariants} from '#/app/splash'
import {AppLayout} from '#/components/layout/app-layout'
import {NotFound} from '#/components/layout/not-found'
import {useT} from '#/i18n'
import {siteHead} from '#/seo/head'
import appCss from '../styles.css?url'

const BASE = import.meta.env.BASE_URL

export const Route = createRootRoute({
  // The site's link preview and default title; pages set their own title (src/seo/head.ts).
  head: () => siteHead(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
})

/**
 * The HTML document. The build renders it into the app shell, which every page is served with, and
 * into /pay's own page. Tags that never change live here; <HeadContent /> adds the route heads (it
 * merges meta by name, which would drop one of the two theme colours). The boot splash shows until
 * the app mounts.
 */
function RootShell({children}: {children: ReactNode}) {
  return (
    // The pre-paint script may set lang and data-theme before React hydrates.
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#d7263d" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1114" media="(prefers-color-scheme: dark)" />
        <meta name="color-scheme" content="light dark" />
        <meta name="application-name" content="QRViet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="QRViet" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="stylesheet" href={appCss} />
        <link rel="manifest" href={`${BASE}manifest.webmanifest`} />
        <link rel="icon" href={`${BASE}favicon.ico`} sizes="48x48" />
        <link rel="icon" href={`${BASE}favicon.svg`} type="image/svg+xml" sizes="any" />
        <link rel="apple-touch-icon" href={`${BASE}apple-touch-icon-180x180.png`} />
        {/* iOS launch screens, one per device size and colour scheme (src/app/splash.ts). */}
        {splashVariants().map((v) => (
          <link key={v.file} rel="apple-touch-startup-image" href={`${BASE}${v.file}`} media={v.media} />
        ))}
        <style dangerouslySetInnerHTML={{__html: BOOT_CSS}} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{__html: PREPAINT_SCRIPT}} />
      </head>
      <body>
        {/* Raw HTML, so AppLayout can fade it out and remove it without React's involvement. */}
        <div dangerouslySetInnerHTML={{__html: BOOT_HTML}} />
        {/* Without JavaScript the splash would never go away. */}
        <noscript dangerouslySetInnerHTML={{__html: '<style>#boot{display:none}</style><p style="padding:24px;text-align:center">Bật JavaScript để dùng QRViet. / Enable JavaScript to use QRViet.</p>'}} />
        {children}
        <Scripts />
      </body>
    </html>
  )
}

/**
 * The app renders in the browser only (a static SPA): the HTML the build writes carries just the
 * head tags and the boot splash, which stays up until this mounts.
 */
function RootComponent() {
  return (
    <ClientOnly>
      <AppProviders>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AppProviders>
    </ClientOnly>
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
