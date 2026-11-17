import {useEffect, useEffectEvent, useRef} from 'react'
import {createFileRoute, useLocation, useNavigate} from '@tanstack/react-router'
import {BrandLoader} from '#/components/brand/brand-loader'
import {resolveOpenDestination} from '#/lib/pwa-deeplink'
import {
  encodeRouteSearch,
  parseOpenSearch,
  rawLocationHash,
  type OpenSearch,
} from '#/lib/route-search'
import {pageHead} from '#/seo/head'

export const Route = createFileRoute('/open')({
  head: () => pageHead('open'),
  validateSearch: parseOpenSearch,
  component: OpenPage,
})

function OpenPage() {
  const search = Route.useSearch()
  const hash = useLocation({select: rawLocationHash})
  const navigate = useNavigate({from: '/open'})
  const handledKeyRef = useRef<string | null>(null)

  const routeIncoming = useEffectEvent((input: OpenSearch) => {
    const key = encodeRouteSearch(input)
    if (handledKeyRef.current === key) return
    handledKeyRef.current = key
    const destination = resolveOpenDestination(input)
    void navigate({
      ...destination,
      replace: true,
      hashScrollIntoView: !destination.hash?.includes('='),
    })
  })

  // Read the fragment after hydration; browsers never send it to the server.
  useEffect(() => {
    routeIncoming(parseOpenSearch(search, hash))
  }, [search, hash])

  return <BrandLoader />
}
