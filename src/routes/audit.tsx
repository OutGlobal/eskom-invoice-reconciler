import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/audit')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/audit"!</div>
}
