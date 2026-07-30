import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Meter Reconciliation" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const rows = useApp((s) => s.rows);
  const uploads = useApp((s) => s.uploads);
  const setRows = useApp((s) => s.setRows);
  const setInvoiceLines = useApp((s) => s.setInvoiceLines);
  const setInvoiceTotal = useApp((s) => s.setInvoiceTotal);

  const reset = () => {
    setRows([]);
    setInvoiceLines({});
    setInvoiceTotal(0);
    location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Application preferences and data management.
        </p>
      </div>

      <Panel title="Application Info">
        <dl className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-y-2">
          <dt className="text-muted-foreground">Loaded intervals</dt>
          <dd>{rows.length.toLocaleString()}</dd>
          <dt className="text-muted-foreground">Uploads this session</dt>
          <dd>{uploads.length}</dd>
          <dt className="text-muted-foreground">Interval resolution</dt>
          <dd>30 minutes</dd>
          <dt className="text-muted-foreground">Power factor</dt>
          <dd>0.96</dd>
        </dl>
      </Panel>

      <Panel
        title="Future Readiness"
        subtitle="This platform is scaffolded for multi-customer, multi-meter, multi-tariff historical reconciliation via Zustand store — hook to Supabase / REST when ready."
      >
        <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            Multiple customers &amp; meters (extend <code>store.ts</code> with arrays)
          </li>
          <li>Multiple tariff books (already an editable object per session)</li>
          <li>Invoice uploads &amp; historical reconciliation</li>
          <li>User authentication + PostgreSQL/Supabase backend</li>
          <li>REST API integration for automated monthly processing</li>
        </ul>
      </Panel>

      <Panel title="Data Management">
        <button
          onClick={reset}
          className="rounded-md border border-red-500/40 bg-red-500/10 text-red-500 px-4 py-2 text-sm hover:bg-red-500/20"
        >
          Clear session &amp; reload sample data
        </button>
      </Panel>
    </div>
  );
}
