import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {extname} from 'node:path'
import type {OpenSearch} from '../src/lib/route-search.ts'

const sourceRoot = new URL('../src/', import.meta.url)

// Run Vite source modules directly in Node without a server or build.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith('#/')
    if (alias) specifier = new URL(specifier.slice(2), sourceRoot).href
    if (
      (alias || (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot.href))) &&
      !extname(specifier)
    )
      specifier += '.ts'
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot.href) && url.endsWith('.json')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${readFileSync(new URL(url), 'utf8')}`,
      }
    }
    const result = nextLoad(url, context)
    if (!url.startsWith(sourceRoot.href) || !url.endsWith('.ts')) return result
    return {
      ...result,
      source: readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env', '({BASE_URL: "/"})'),
    }
  },
})

const {resolveOpenDestination} = await import('../src/lib/pwa-deeplink.ts')
const {encodeRouteSearch, parseOpenSearch, rawLocationHash} =
  await import('../src/lib/route-search.ts')
const {NAV_ITEMS, hasNavEntry} = await import('../src/app/nav.ts')

const text = 'Cà phê + 50% & a=b #☕'
const qrUri = `web+qrviet://qr?${encodeRouteSearch({type: 'text', text})}`
const payment = {bank: '970436', acc: '0071000888999', amount: '150000', memo: text}

const cases: Array<{input: OpenSearch; to: string; fields: Record<string, string>}> = [
  {input: {}, to: '/', fields: {}},
  {input: {q: '   '}, to: '/', fields: {}},
  {
    input: {phone: '0912345678'},
    to: '/qr',
    fields: {type: 'phone', phone: '+84912345678'},
  },
  {input: {url: qrUri}, to: '/qr', fields: {type: 'text', text}},
  {
    input: {q: qrUri.replace('web+qrviet:', 'web+vietqr:')},
    to: '/qr',
    fields: {type: 'text', text},
  },
  {
    input: {q: `https://qrviet.nghiep.dev/qr#${encodeRouteSearch({type: 'text', text})}`},
    to: '/qr',
    fields: {type: 'text', text},
  },
  {input: {q: text, intent: 'scan'}, to: '/scan', fields: {text}},
  {input: {q: 'web+qrviet:'}, to: '/scan', fields: {text: 'web+qrviet:'}},
  {
    input: {q: `web+qrviet://open?${encodeRouteSearch({q: qrUri})}`},
    to: '/qr',
    fields: {type: 'text', text},
  },
  {
    input: {url: `web+qrviet://pay#${encodeRouteSearch(payment)}`},
    to: '/pay',
    fields: payment,
  },
  {
    input: {shareId: 'shared-image', text, url: 'https://example.com', title: 'Ảnh QR'},
    to: '/scan',
    fields: {shareId: 'shared-image', text, url: 'https://example.com', title: 'Ảnh QR'},
  },
  {input: {shareError: true, text}, to: '/scan', fields: {shareError: 'true', text}},
]

for (const {input, to, fields} of cases) {
  const destination = resolveOpenDestination(parseOpenSearch(input))
  assert.equal(destination.to, to)
  assert.deepEqual(destination.search, {})
  assert.deepEqual(Object.fromEntries(new URLSearchParams(destination.hash)), fields)
}

const href = `https://qrviet.nghiep.dev/open#${encodeRouteSearch({url: qrUri})}`
const fragmentInput = parseOpenSearch({url: 'https://example.com/old'}, rawLocationHash({href}))
assert.equal(fragmentInput.url, qrUri)
assert.equal(resolveOpenDestination(fragmentInput).to, '/qr')
assert.deepEqual(
  NAV_ITEMS.filter((item) => item.to === '/open'),
  [],
)
assert.equal(hasNavEntry('/open'), false)
assert.equal(hasNavEntry('/pay'), true)

const manifest = JSON.parse(
  readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
)
assert.deepEqual(manifest.protocol_handlers, [
  {protocol: 'web+qrviet', url: './open#url=%s'},
  {protocol: 'web+vietqr', url: './open#url=%s'},
])
assert.equal(
  manifest.shortcuts.some((shortcut: {url: string}) => shortcut.url.startsWith('./open')),
  false,
)
console.log(
  `PWA deeplink checks passed: ${cases.length} routing cases, fragments, navigation and protocol handlers.`,
)
