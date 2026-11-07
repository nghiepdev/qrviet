import {copyFileSync, existsSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {defineConfig, type Plugin} from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {tanstackRouter} from '@tanstack/router-plugin/vite'
import {VitePWA} from 'vite-plugin-pwa'

// Static hosting: set BASE_PATH=/sub/ when the app is not served from the root
// (e.g. GitHub Pages project sites). Everything else is relative to it.
const base = process.env.BASE_PATH ?? '/'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {version: string}

const BRAND_RED = '#d7263d'
const BRAND_PAPER = '#fff8f4'

/**
 * Static hosts without rewrite rules (GitHub Pages, Surge…) serve 404.html for
 * unknown paths; shipping a copy of index.html there keeps deep links working.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'qrviet:spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  resolve: {tsconfigPaths: true},
  plugins: [
    tanstackRouter({target: 'react', autoCodeSplitting: true}),
    viteReact(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Everything in /public is picked up by globPatterns below (no includeAssets → no duplicates).
      manifest: {
        id: base,
        name: 'QRViet — Tiện ích VietQR',
        short_name: 'QRViet',
        description:
          'Tạo, quét và chia sẻ mã VietQR chuyển khoản cho mọi ngân hàng Việt Nam. Miễn phí, riêng tư, chạy cả khi offline.',
        lang: 'vi',
        dir: 'ltr',
        start_url: `${base}?source=pwa`,
        scope: base,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: BRAND_PAPER,
        theme_color: BRAND_RED,
        categories: ['finance', 'utilities', 'productivity'],
        icons: [
          {src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png'},
          {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
          {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
          {src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          {src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml'},
        ],
        shortcuts: [
          {
            name: 'Tạo mã VietQR',
            short_name: 'Tạo QR',
            url: `${base}?source=shortcut`,
            icons: [{src: 'shortcuts/create.png', sizes: '96x96', type: 'image/png'}],
          },
          {
            name: 'Quét mã QR',
            short_name: 'Quét QR',
            url: `${base}scan?source=shortcut`,
            icons: [{src: 'shortcuts/scan.png', sizes: '96x96', type: 'image/png'}],
          },
          {
            name: 'Sổ tài khoản',
            short_name: 'Tài khoản',
            url: `${base}accounts?source=shortcut`,
            icons: [{src: 'shortcuts/accounts.png', sizes: '96x96', type: 'image/png'}],
          },
        ],
        // Share a VietQR string (or any text/link) from another app straight
        // into the decoder.
        share_target: {
          action: `${base}scan`,
          method: 'GET',
          params: {title: 'title', text: 'text', url: 'url'},
        },
        screenshots: [
          {src: 'screenshots/wide-create.webp', sizes: '1280x800', type: 'image/webp', form_factor: 'wide', label: 'Tạo mã VietQR với mẫu ảnh đẹp'},
          {src: 'screenshots/wide-scan.webp', sizes: '1280x800', type: 'image/webp', form_factor: 'wide', label: 'Quét và kiểm tra mã VietQR'},
          {src: 'screenshots/narrow-create.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'Tạo mã ngay trên điện thoại'},
          {src: 'screenshots/narrow-themes.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'Đa giao diện, chế độ tối'},
        ],
        launch_handler: {client_mode: ['navigate-existing', 'auto']},
        handle_links: 'preferred',
        prefer_related_applications: false,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,json,webmanifest}'],
        // Only Vietnamese/Latin glyph subsets are needed offline.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,math,symbols}-*.woff2', '404.html', 'og-image.png', 'screenshots/**'],
        navigateFallback: `${base}index.html`,
        // File-like paths (/sw.js, /assets/x.css) never fall back to the app shell; the check stops at
        // the query string so shared URLs such as /scan?url=https://site/a.html still work offline.
        navigateFallbackDenylist: [/^[^?]*\/[^/?]+\.[^/?]+$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // User-provided images (e.g. remote logos pasted as URLs).
            urlPattern: ({request, sameOrigin}) => !sameOrigin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'qrviet-remote-images',
              expiration: {maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30},
              cacheableResponse: {statuses: [0, 200]},
            },
          },
        ],
      },
      devOptions: {enabled: false},
    }),
    spaFallback(),
  ],
  build: {
    target: 'es2022',
    cssTarget: ['chrome111', 'safari16.4', 'firefox128'],
    chunkSizeWarningLimit: 900,
  },
  server: {port: 3000},
  preview: {port: 4173},
})
