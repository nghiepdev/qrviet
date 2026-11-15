import {createFileRoute, useRouterState} from '@tanstack/react-router'
import {PayView} from '#/components/pay/pay-view'
import {decodePayLink, type PayLinkData} from '#/lib/paylink'
import {getBankByBin, resolveBank, type Bank} from '#/data/banks'
import {payHead} from '#/seo/head'

export const Route = createFileRoute('/pay')({
  head: ({match}) => payHead(match.search),
  component: PayPage,
})

/**
 * The payment link carried in the URL fragment (and, for a detailed link preview, the query
 * string), decoded, plus its bank. A hook so the values reach PayPage frozen and the compiler
 * can memoize everything derived from them.
 */
function usePayLink(): {data: PayLinkData | null; bank: Bank | undefined} {
  const hash = useRouterState({select: (s) => s.location.hash})
  const search = useRouterState({select: (s) => s.location.searchStr})
  const data = decodePayLink(hash || (typeof location !== 'undefined' ? location.hash : ''), search)
  return {data, bank: data ? (getBankByBin(data.bin) ?? resolveBank(data.bin)) : undefined}
}

function PayPage() {
  const {data, bank} = usePayLink()
  if (!data || !bank) {
    return (
      <div className="p-6 lg:p-12">
        <PayView data={data} bank={bank} />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <PayView data={data} bank={bank} />
    </div>
  )
}
