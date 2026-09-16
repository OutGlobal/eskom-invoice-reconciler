import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/demand')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/demand"!</div>
}
