import {createFileRoute} from '@tanstack/react-router'
import {NotFound} from '#/components/layout/not-found'
import {pageHead} from '#/seo/head'

/** Any URL no page matches: the host serves it the app shell, and this keeps it out of search. */
export const Route = createFileRoute('/$')({
  head: () => pageHead('notFound'),
  component: NotFound,
})
