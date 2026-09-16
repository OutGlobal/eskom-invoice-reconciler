import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/invoices')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/invoices"!</div>
}
