import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import './styles.css'

import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {RouterProvider, createRouter} from '@tanstack/react-router'
import {routeTree} from './routeTree.gen'
import {BrandLoader} from '#/components/brand/BrandLoader'
import {capturePwaEvents} from '#/app/pwa'

capturePwaEvents()

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  scrollRestoration: true,
  defaultPreload: 'intent',
  // Query values stay plain strings: the default parser JSON-parses and coerces
  // ("1" → 1, long account numbers → lossy floats); routes validate their own params.
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)),
  stringifySearch: (search) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
      if (value === undefined || value === null) continue
      params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    const query = params.toString()
    return query ? `?${query}` : ''
  },
  defaultPendingMs: 200,
  defaultPendingMinMs: 350,
  defaultPendingComponent: () => (
    <div className="p-4 lg:p-8">
      <BrandLoader delay={0} />
    </div>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
