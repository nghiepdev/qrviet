import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {defineConfig, type Plugin, type ResolvedConfig} from 'vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {serwist, type PluginOptions, type SerwistViteApi} from '@serwist/vite'

// Static hosting: set BASE_PATH=/sub/ when the app is not served from the root
// (e.g. GitHub Pages project sites). Everything else is relative to it.
const base = process.env.BASE_PATH ?? '/'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * Public production URL of the app, for the absolute image URL that link
 * previews need. Set SITE_URL (origin or full URL); on Netlify and Vercel the
 * production domain is picked up automatically, previews included. Always ends
 * with the base path + '/'.
 */
function resolveSiteUrl(env: NodeJS.ProcessEnv): string {
  const raw =
    env.SITE_URL ||
    (env.NETLIFY === 'true' ? env.URL : '') ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!raw) return ''
  const url = new URL(raw)
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${path ? `${path}/` : base}`
}
const siteUrl = resolveSiteUrl(process.env)

/**
 * @serwist/vite, adapted to TanStack Start. Start builds the client and the server with shared plugin
 * instances, and Serwist keeps the last config it was given, the server's, so its own build step
 * never writes sw.js. The worker is built here instead: for the client output, and after Start has
 * written the HTML pages, so they can be precached.
 */
function serwistForStart(options: Omit<PluginOptions, 'globDirectory'>): Plugin[] {
  // Serwist requires the folder up front; the client output is only known once the build runs.
  const opts: PluginOptions = {...options, globDirectory: '.'}
  const [main, , dev] = serwist(opts)
  return [
    main,
    dev,
    {
      name: 'serwist-for-start',
      apply: 'build',
      enforce: 'post',
      buildApp: {
        order: 'post',
        async handler(builder) {
          const client = builder.environments.client.config
          opts.globDirectory = resolve(client.root, client.build.outDir)
          await (main.configResolved as (config: ResolvedConfig) => Promise<void>)(client)
          await (main.api as SerwistViteApi).generateSW()
        },
      },
    },
  ]
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __SITE_URL__: JSON.stringify(siteUrl),
  },
  resolve: {tsconfigPaths: true},
  plugins: [
    // TanStack Start as a static SPA: the app renders in the browser, and the build writes the app
    // shell (_shell.html), which public/_redirects serves for every page, so they all share one link
    // preview. /pay gets its own HTML too, so that a shared payment link previews as one.
    tanstackStart({
      spa: {enabled: true},
      // pay.html, which Netlify serves at /pay; pay/index.html would redirect to /pay/.
      pages: [{path: '/pay', prerender: {autoSubfolderIndex: false}}],
    }),
    // React Compiler, the Rust port (oxc-transform-react), memoizes components and hooks, so the code
    // has no useMemo/useCallback/memo. A component that breaks a Rules of React check is left
    // uncompiled instead of failing the build (the compiler default). There is no per-rule switch, and
    // since 0.157 the Immutability check counts as critical, so stricter thresholds also fail on it.
    viteReact({compiler: true}),
    tailwindcss(),
    // Service worker: src/sw.ts, built to sw.js with the precache list injected (see src/sw.ts).
    serwistForStart({
      swSrc: 'src/sw.ts',
      swDest: 'sw.js',
      rollupFormat: 'iife',
      globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,webmanifest}'],
      globIgnores: [
        // Only Vietnamese/Latin glyph subsets are needed offline.
        '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,math,symbols}-*.woff2',
        // Link preview images, which only the apps that show previews fetch.
        'og-image*.png',
        'screenshots/**',
        // iOS fetches only the launch screen that matches the device, when the app is added.
        'splash/**',
      ],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    }),
  ],
  build: {
    target: 'es2022',
    cssTarget: ['chrome111', 'safari16.4', 'firefox128'],
    chunkSizeWarningLimit: 900,
  },
  server: {port: 3000},
  preview: {port: 4173},
})
