import {DEFAULT_SETTINGS, type Locale} from '#/stores/settings'
import {translate, type MessageKey} from '#/i18n'
import {getBankByBin} from '#/data/banks'
import {payPreview} from '#/seo/pay-preview'

/**
 * Route `head` helpers. The build renders the root's head into the app shell (_shell.html), the HTML
 * every page is served with, so link previews show one card for the whole site; /pay has its own
 * HTML (pay.html) with a payment card. In the app, <HeadContent /> keeps each page's title current,
 * on navigation and when the language changes.
 */

/**
 * Language of the head tags. It starts as the one the build renders, so the app takes over the
 * served head as it is (hydration would leave tags it rendered differently behind); once the app is
 * up, AppProviders switches it to the user's.
 */
let headLocale: Locale = DEFAULT_SETTINGS.locale

/** Sets the language of the head tags; true when it changed, and the route heads should re-run. */
export function setHeadLocale(locale: Locale): boolean {
  if (locale === headLocale) return false
  headLocale = locale
  return true
}

const t = (key: MessageKey, vars?: Record<string, string>) => translate(headLocale, key, vars)

/**
 * A link preview image (1200 × 630, in public/), followed by the tags that describe it: Open Graph
 * reads those as belonging to the og:image above them. Previews need an absolute URL, known once
 * SITE_URL is (vite.config.ts).
 */
function previewImage(file: string, alt: string) {
  return [
    {property: 'og:image', content: `${__SITE_URL__ || import.meta.env.BASE_URL}${file}`},
    {property: 'og:image:width', content: '1200'},
    {property: 'og:image:height', content: '630'},
    {property: 'og:image:alt', content: alt},
  ]
}

/**
 * The link preview every page but /pay shares, and the default title, the home page's. There is no
 * og:url or canonical link: every page is served this same HTML, and previews would then send each
 * shared link to that one address, a payment link without its `#` data.
 */
export function siteHead() {
  const title = t('seo.home.title')
  const description = t('seo.home.description')
  return {
    meta: [
      {title},
      {name: 'description', content: description},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'QRViet'},
      {property: 'og:locale', content: 'vi_VN'},
      {property: 'og:title', content: title},
      {property: 'og:description', content: description},
      ...previewImage('og-image.png', `QRViet — ${t('app.tagline')}`),
      {name: 'twitter:card', content: 'summary_large_image'},
    ],
  }
}

const CANONICAL_HOME = __SITE_URL__ || 'https://qrviet.nghiep.dev/'

/** Canonical link for the homepage, keeping query-parameter variants consolidated on `/`. */
export function homeHead() {
  return {
    links: [{rel: 'canonical', href: CANONICAL_HOME}],
  }
}

type PageId =
  | 'scan'
  | 'qr'
  | 'link'
  | 'batch'
  | 'tools'
  | 'banks'
  | 'accounts'
  | 'history'
  | 'open'
  | 'settings'
  | 'about'
  | 'notFound'

/** Keep search indexing focused solely on the homepage; sub-pages still get their own tab title. */
export function pageHead(id: PageId) {
  return {
    meta: [{title: t(`seo.${id}.title`)}, {name: 'robots', content: 'noindex'}],
  }
}

/**
 * /pay's own card, in pay.html. It stays general: a payment link carries its details after the `#`,
 * which never leaves the browser, so link previews, fetched without it, cannot show them. A link
 * that opts in to a detailed preview carries the bank, name and amount in its query string instead,
 * and gets a title and description from them (src/seo/pay-preview.ts). On Netlify the page is
 * served with these too; served the plain pay.html (the service worker, other hosts), the app
 * leaves that page's tags next to its own, which only link previews read, and they never see them.
 */
export function payHead(search: Record<string, unknown> = {}) {
  // The router has parsed the values of the query string; as strings again, they read as the edge function's.
  const query = new URLSearchParams(
    Object.entries(search).map(([key, value]) => [key, String(value)]),
  )
  const preview = payPreview(query.toString(), t, (bin) => getBankByBin(bin)?.shortName)
  const title = preview?.title ?? t('seo.pay.title')
  const description = preview?.description ?? t('seo.pay.description')
  return {
    meta: [
      {title},
      {name: 'description', content: description},
      {name: 'robots', content: 'noindex'},
      {property: 'og:title', content: title},
      {property: 'og:description', content: description},
      ...previewImage('og-image-pay.png', t('seo.pay.title')),
    ],
  }
}
