/**
 * Service worker (Serwist, built into dist/client/sw.js; see vite.config.ts).
 *
 * - Precaches the app shell, bank logos and fonts (the list is injected at build
 *   time into `self.__SW_MANIFEST`), so the whole app works offline.
 * - Navigations get the cached app shell (_shell.html, written by TanStack
 *   Start), which renders whatever route the URL names, offline too. /pay is
 *   served its own page (pay.html, found as a clean URL), and file-like URLs
 *   (/robots.txt, /assets/x.js) never get the shell.
 * - Updates wait for the user: PwaManager shows "new version" and only then
 *   asks this worker to skip waiting (Serwist handles that message itself
 *   when `skipWaiting` is false).
 */
import {CacheableResponsePlugin, ExpirationPlugin, Serwist, StaleWhileRevalidate, type PrecacheEntry, type SerwistGlobalConfig} from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    // No query string picks another file here: /pay?b=… (a detailed link preview) is pay.html too.
    ignoreURLParametersMatching: [/.*/],
    navigateFallback: `${import.meta.env.BASE_URL}_shell.html`,
    // Stop at the query string: "/scan?text=a.b" is a route, "/sw.js" is a file.
    navigateFallbackDenylist: [/^[^?]*\/[^/?]+\.[^/?]+$/],
  },
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [
    {
      // User-provided images (e.g. remote logos pasted as URLs).
      matcher: ({request, sameOrigin}) => !sameOrigin && request.destination === 'image',
      handler: new StaleWhileRevalidate({
        cacheName: 'qrviet-remote-images',
        plugins: [new ExpirationPlugin({maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30}), new CacheableResponsePlugin({statuses: [0, 200]})],
      }),
    },
  ],
})

serwist.addEventListeners()
