/**
 * Netlify only, and optional. A payment link that opts in to a detailed link preview (payLinkUrl in
 * src/lib/paylink.ts) carries its bank, name and amount in the query string; this writes them into
 * the title and description of pay.html, the page that Zalo, Facebook and other apps fetch to show
 * the link. Any other request to /pay, or one this fails on, gets pay.html as it is.
 *
 * Netlify runs it in Deno, which knows neither Vite nor the #/ alias: it imports only app modules
 * that import nothing but each other, by relative paths.
 */
import banks from '../../src/data/banks.json' with {type: 'json'}
import {vi, type MessageKey} from '../../src/i18n/vi.ts'
import {payPreview} from '../../src/seo/pay-preview.ts'

/** In Vietnamese, the language the build writes the HTML pages in. */
function t(key: MessageKey, vars: Record<string, string> = {}): string {
  return vi[key].replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match)
}

const bankName = (bin: string) => banks.find((bank) => bank.bin === bin)?.shortName

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** Puts `value` in the content of the meta tag that `opening` starts, as React writes it. */
const setContent = (html: string, opening: string, value: string) => html.replace(new RegExp(`(${opening} content=")[^"]*`), (_, start: string) => start + value)

export default async (request: Request, context: {next: () => Promise<Response>}) => {
  const preview = payPreview(new URL(request.url).search, t, bankName)
  // Returning nothing lets Netlify carry on and serve pay.html.
  if (!preview) return
  const page = await context.next()
  if (!page.headers.get('content-type')?.startsWith('text/html')) return page
  const title = escapeHtml(preview.title)
  const description = escapeHtml(preview.description)
  let html = (await page.text()).replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
  html = setContent(html, '<meta name="description"', description)
  html = setContent(html, '<meta property="og:title"', title)
  html = setContent(html, '<meta property="og:description"', description)
  // The body is no longer the file's: drop its length and its validator.
  const headers = new Headers(page.headers)
  headers.delete('content-length')
  headers.delete('etag')
  return new Response(html, {status: page.status, headers})
}

export const config = {path: '/pay', onError: 'bypass'}
