import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Panel } from "@/components/dashboard/parts";
import { supabase } from "@/lib/supabase";
import { Building2, Plus, CheckCircle2, ShieldCheck, MapPin, Hash, Zap } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Enterprise Customer & Site Directory — Eskom Bill Balancer" }] }),
  component: CustomersPage,
});

interface CustomerRecord {
  id?: string;
  account_number: string;
  customer_name: string;
  meter_number: string;
  address: string;
  nmd: number;
  voltage?: string;
  tariff?: string;
}

function CustomersPage() {
  const customer = useApp((s) => s.customer);
  const setCustomer = useApp((s) => s.setCustomer);

  const [customerList, setCustomerList] = useState<CustomerRecord[]>(() => {
    if (customer && customer.accountNumber) {
      return [
        {
          account_number: customer.accountNumber,
          customer_name: customer.name || "Active Customer",
          meter_number: customer.meter || "",
          address: customer.address || "",
          nmd: customer.nmd || 0,
          voltage: "33 kV",
          tariff: "Megaflex Non-Local Authority",
        },
      ];
    }
    return [];
  });
  const [selectedAcc, setSelectedAcc] = useState<string>(customer.accountNumber || "");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [newAcc, setNewAcc] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newMeter, setNewMeter] = useState<string>("");
  const [newAddr, setNewAddr] = useState<string>("");
  const [newNmd, setNewNmd] = useState<number>(50000);

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          const mapped: CustomerRecord[] = data.map((c) => ({
            id: c.id,
            account_number: c.account_number,
            customer_name: c.customer_name,
            meter_number: c.meter_number,
            address: c.address || "",
            nmd: Number(c.nmd) || 0,
            voltage: "33 kV",
            tariff: "Megaflex Non-Local Authority",
          }));
          setCustomerList(mapped);
          if (!selectedAcc && mapped.length > 0) {
            setSelectedAcc(mapped[0].account_number);
          }
        }
      });
  }, []);

  const handleSelectCustomer = (c: CustomerRecord) => {
    setSelectedAcc(c.account_number);
    setCustomer({
      name: c.customer_name,
      meter: c.meter_number,
      accountNumber: c.account_number,
      address: c.address,
      nmd: c.nmd,
    });
    toast.success(`Active customer profile switched to ${c.customer_name}`);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAcc || !newName) {
      toast.error("Account Number and Customer Name are required!");
      return;
    }

    const rec: CustomerRecord = {
      account_number: newAcc,
      customer_name: newName,
      meter_number: newMeter || `MTR-${Date.now()}`,
      address: newAddr || "Rustenburg Operations",
      nmd: newNmd,
      voltage: "33 kV",
      tariff: "Megaflex Non-Local Authority",
    };

    setCustomerList((prev) => [rec, ...prev]);
    setShowAddModal(false);

    try {
      const dbPayload = {
        account_number: rec.account_number,
        customer_name: rec.customer_name,
        meter_number: rec.meter_number,
        address: rec.address,
        nmd: rec.nmd,
      };
      const { error } = await supabase.from("customers").upsert(dbPayload, { onConflict: "account_number" });
      if (error) {
        console.warn("Supabase customer sync notice:", error.message);
        toast.success(`Customer ${newName} added locally.`);
      } else {
        toast.success(`Customer ${newName} added and synchronized!`);
      }
    } catch (err) {
      toast.success(`Customer ${newName} added locally.`);
    }

    setNewAcc("");
    setNewName("");
    setNewMeter("");
    setNewAddr("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Enterprise Customer &amp; Site Directory
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage multi-site industrial customer accounts, supply points, meter numbers, and NMD
            caps.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-3 py-1.5 font-medium transition shadow-xs"
        >
          <Plus className="h-4 w-4" /> Add Industrial Site Profile
        </button>
      </div>

      {/* Active Customer Edit Form */}
      <Panel
        title="Active Customer Profile"
        subtitle="Edit metadata for the currently active billing session."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field
            label="Customer Name"
            value={customer.name}
            onChange={(v) => setCustomer({ name: v })}
          />
          <Field
            label="Meter Number"
            value={customer.meter}
            onChange={(v) => setCustomer({ meter: v })}
          />
          <Field
            label="Eskom Account Number"
            value={customer.accountNumber}
            onChange={(v) => setCustomer({ accountNumber: v })}
          />
          <Field
            label="Supply Site Address"
            value={customer.address}
            onChange={(v) => setCustomer({ address: v })}
          />
          <Field
            label="Notified Max Demand (kVA)"
            type="number"
            value={String(customer.nmd)}
            onChange={(v) => setCustomer({ nmd: Number(v) || 0 })}
          />
        </div>
      </Panel>

      {/* Customer Directory Table */}
      <Panel
        title="Managed Industrial Accounts & Sites"
        subtitle="Select a site profile to switch active analytics context or edit parameters."
      >
        {customerList.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <div className="font-semibold text-foreground text-sm">No Industrial Accounts Configured</div>
            <p className="mt-1 max-w-md mx-auto">
              Upload an Eskom Tax Invoice or AMR interval dataset, or add an enterprise site profile manually to begin account tracking.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded shadow hover:bg-primary/90"
            >
              Add Site Profile
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium uppercase tracking-wider">
                <tr>
                  <th className="p-3">Customer &amp; Site Name</th>
                  <th className="p-3">Eskom Account #</th>
                  <th className="p-3">Meter ID</th>
                  <th className="p-3">Supply Voltage</th>
                  <th className="p-3 text-right">NMD Cap (kVA)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customerList.map((c, idx) => {
                  const isActive = c.account_number === customer.accountNumber;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-muted/20 transition ${
                        isActive ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{c.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" /> {c.address}
                        </div>
                      </td>
                      <td className="p-3 font-mono">{c.account_number}</td>
                      <td className="p-3 font-mono">{c.meter_number}</td>
                      <td className="p-3">{c.voltage || "33 kV"}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {c.nmd.toLocaleString()} kVA
                      </td>
                      <td className="p-3 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Active Context
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Configured
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSelectCustomer(c)}
                          disabled={isActive}
                          className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                            isActive
                              ? "opacity-50 cursor-not-allowed text-muted-foreground"
                              : "bg-secondary hover:bg-secondary/80 text-foreground"
                          }`}
                        >
                          {isActive ? "Active" : "Select Context"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-semibold">Add Industrial Site Profile</h3>
            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Eskom Account Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7856504676"
                  value={newAcc}
                  onChange={(e) => setNewAcc(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Customer / Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Impala Smelter Operations"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Meter ID</label>
                <input
                  type="text"
                  placeholder="e.g. 7856504226"
                  value={newMeter}
                  onChange={(e) => setNewMeter(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">
                  Notified Max Demand (kVA)
                </label>
                <input
                  type="number"
                  value={newNmd}
                  onChange={(e) => setNewNmd(Number(e.target.value) || 0)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Site Address</label>
                <input
                  type="text"
                  placeholder="e.g. Rustenburg Industrial Complex"
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80 text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border border-border rounded px-3 py-2 text-sm"
      />
    </label>
  );
}
