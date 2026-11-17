import {useEffect} from 'react'
import {createFileRoute, useLocation, useNavigate} from '@tanstack/react-router'
import {pageHead} from '#/seo/head'
import {parseScanSearch, privateDestination, rawLocationHash} from '#/lib/route-search'

export const Route = createFileRoute('/share-target')({
  head: () => pageHead('open'),
  validateSearch: parseScanSearch,
  component: ShareTargetFallback,
})

/**
 * Fallback route for GET `/share-target` (e.g. if the Service Worker has not
 * taken control yet). Redirects straight into `/open` so the payload is routed
 * and pre-filled.
 */
function ShareTargetFallback() {
  const hash = useLocation({select: rawLocationHash})
  const search = parseScanSearch(Route.useSearch(), hash)
  const navigate = useNavigate({from: '/share-target'})

  useEffect(() => {
    void navigate({
      ...privateDestination({
        to: '/open',
        search: {
          title: search.title,
          text: search.text,
          url: search.url,
          shareId: search.shareId,
          shareError: search.shareError,
          source: 'share',
        },
      }),
      replace: true,
      hashScrollIntoView: false,
    })
  }, [navigate, search.text, search.title, search.url, search.shareId, search.shareError])

  return null
}
