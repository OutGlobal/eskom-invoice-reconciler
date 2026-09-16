import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reconciliation')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/reconciliation"!</div>
}
