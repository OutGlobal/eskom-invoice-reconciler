import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/energy')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/energy"!</div>
}
