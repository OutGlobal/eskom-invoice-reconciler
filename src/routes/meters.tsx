import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/meters')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/meters"!</div>
}
