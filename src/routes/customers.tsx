import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Panel } from "@/components/dashboard/parts";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customers — Meter Reconciliation" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const customer = useApp((s) => s.customer);
  const setCustomer = useApp((s) => s.setCustomer);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Customers</h1>
        <p className="text-xs text-muted-foreground">Active customer profile used across analytics and reports.</p>
      </div>

      <Panel title="Customer Profile" subtitle="Edit the metadata attached to the current dataset.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <Field label="Customer Name" value={customer.name} onChange={(v) => setCustomer({ name: v })} />
          <Field label="Meter" value={customer.meter} onChange={(v) => setCustomer({ meter: v })} />
          <Field label="Account Number" value={customer.accountNumber} onChange={(v) => setCustomer({ accountNumber: v })} />
          <Field label="Site Address" value={customer.address} onChange={(v) => setCustomer({ address: v })} />
          <Field label="Notified Maximum Demand (kVA)" type="number"
            value={String(customer.nmd)}
            onChange={(v) => setCustomer({ nmd: Number(v) || 0 })} />
        </div>
      </Panel>

      <Panel title="Customer List" subtitle="Multi-customer support is scaffolded — extend by adding an array store.">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Meter</th>
                <th className="text-left px-3 py-2">Account</th>
                <th className="text-right px-3 py-2">NMD (kVA)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-3 py-2 font-medium">{customer.name}</td>
                <td className="px-3 py-2">{customer.meter}</td>
                <td className="px-3 py-2">{customer.accountNumber}</td>
                <td className="px-3 py-2 text-right tabular-nums">{customer.nmd.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border border-border rounded px-3 py-2 text-sm" />
    </label>
  );
}
