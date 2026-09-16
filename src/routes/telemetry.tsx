import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/telemetry')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/telemetry"!</div>
}
