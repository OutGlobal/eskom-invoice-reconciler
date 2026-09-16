import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/municipal')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/municipal"!</div>
}
