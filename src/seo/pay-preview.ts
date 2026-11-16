/**
 * The detailed link preview of a payment link that opts in to one (payLinkUrl): the payee, amount
 * and bank, read from the query string. The Netlify edge function writes it into pay.html for the
 * apps that fetch link previews (netlify/edge-functions/pay-preview.ts), and the app renders the
 * same tags (payHead), so that the head it takes over matches the one it was served.
 *
 * The edge function runs in Deno, which knows neither Vite nor the #/ alias: this module imports
 * only modules that import nothing, by relative paths, and gets the language and bank names from
 * its caller.
 */
import type {MessageKey} from '../i18n/vi.ts'
import {formatVnd} from '../lib/money.ts'
import {payLinkPreview} from '../lib/paylink.ts'

type Translate = (key: MessageKey, vars?: Record<string, string>) => string

/** The title and description of a link's detailed preview; null when the link has none. */
export function payPreview(
  search: string,
  t: Translate,
  bankName: (bin: string) => string | undefined,
) {
  const preview = payLinkPreview(search)
  if (!preview) return null
  const {name} = preview
  const amount = preview.amount ? formatVnd(preview.amount, true) : ''
  const title =
    name && amount
      ? t('seo.pay.sendTo', {amount, name})
      : name
        ? t('seo.pay.to', {name})
        : t('seo.pay.amount', {amount})
  const description = [bankName(preview.bin), t('seo.pay.description')].filter(Boolean).join(' · ')
  return {title, description}
}
