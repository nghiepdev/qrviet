import {createRouter} from '@tanstack/react-router'
import {routeTree} from './routeTree.gen'
import {BrandLoader} from '#/components/brand/brand-loader'
import {isSearchBot} from '#/app/boot-splash'
import {capturePwaEvents} from '#/app/pwa'
import {trackTyping} from '#/app/keyboard'
import {trackToolbarOverlap} from '#/app/viewport'

// Browser-only start-up. TanStack Start also loads this module in Node, to write the HTML pages at build time.
if (typeof window !== 'undefined') {
  capturePwaEvents()
  trackTyping()
  trackToolbarOverlap()

  // Once the app has settled, drop the stored images of history entries that are gone (src/lib/thumbs.ts).
  setTimeout(() => {
    void Promise.all([import('#/lib/thumbs'), import('#/stores/history')]).then(
      ([{pruneThumbs}, {historyStore}]) => pruneThumbs(historyStore.state.map((h) => h.id)),
    )
  }, 5000)
}

/** TanStack Start's router entry. Start sets the base path itself, from Vite's `base`. */
export function getRouter() {
  const isBot = isSearchBot()
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Query values stay plain strings: the default parser JSON-parses and coerces
    // ("1" → 1, long account numbers → lossy floats); routes validate their own params.
    parseSearch: (search) =>
      Object.fromEntries(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)),
    stringifySearch: (search) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(search)) {
        if (value === undefined || value === null) continue
        params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
      }
      const query = params.toString()
      return query ? `?${query}` : ''
    },
    defaultPendingMs: isBot ? 1000 : 200,
    defaultPendingMinMs: isBot ? 0 : 350,
    defaultPendingComponent: () => (
      <div className="p-4 lg:p-8">
        <BrandLoader delay={0} />
      </div>
    ),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
