/**
 * Invoice Review Workspace Component
 * Authoritative Human-in-the-Loop Review, Correction Audit Trail,
 * Lifecycle Progression Controls & End-to-End Evidence Drill-Down Navigation.
 */

import React, { useState } from "react";
import type { ExtractedInvoiceDocument, ExtractedField, InvoiceLifecycleState, InvoiceCorrectionEntry } from "../../domain/invoice/types";
import { InvoiceLifecycleService } from "../../domain/invoice/invoiceLifecycleService";
import { InvoiceCorrectionService } from "../../domain/invoice/invoiceCorrectionService";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Edit2,
  Save,
  FileText,
  Check,
  ShieldAlert,
  History,
  Layers,
  ArrowRight,
  Info,
  X,
  ChevronRight,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

interface InvoiceReviewWorkspaceProps {
  document: ExtractedInvoiceDocument;
  onApprove: (updatedDocument: ExtractedInvoiceDocument) => void;
  onStateChange?: (newState: InvoiceLifecycleState) => void;
  onCancel?: () => void;
}

export const InvoiceReviewWorkspace: React.FC<InvoiceReviewWorkspaceProps> = ({
  document: initialDoc,
  onApprove,
  onStateChange,
  onCancel,
}) => {
  const [doc, setDoc] = useState<ExtractedInvoiceDocument>(initialDoc);
  const [activeTab, setActiveTab] = useState<
    "header" | "energy" | "financial" | "items" | "discrepancies" | "audit_log"
  >("header");

  // Edit Modal State
  const [editingFieldKey, setEditingFieldKey] = useState<keyof ExtractedInvoiceDocument | null>(null);
  const [editForm, setEditForm] = useState<{
    correctedValue: string;
    reason: string;
    userName: string;
    approvedBy: string;
  }>({
    correctedValue: "",
    reason: "",
    userName: "Energy Auditor",
    approvedBy: "",
  });

  // Drill-down Modal State
  const [drillDownTarget, setDrillDownTarget] = useState<{
    fieldName: string;
    label: string;
    field: ExtractedField<any>;
  } | null>(null);

  const currentState = doc.lifecycle_state || InvoiceLifecycleService.determineInitialState(doc, doc.validation_summary);

  const handleOpenEditModal = (fieldKey: keyof ExtractedInvoiceDocument, field: ExtractedField<any>) => {
    setEditingFieldKey(fieldKey);
    setEditForm({
      correctedValue: String(field.value ?? ""),
      reason: "",
      userName: "Energy Auditor",
      approvedBy: "",
    });
  };

  const handleConfirmCorrection = async () => {
    if (!editingFieldKey) return;
    if (!editForm.reason || editForm.reason.trim().length === 0) {
      toast.error("An audit reason is required for compliance before saving corrections.");
      return;
    }

    try {
      const fieldObj = doc[editingFieldKey] as ExtractedField<any>;
      const updatedDoc = InvoiceCorrectionService.applyCorrection(doc, {
        invoiceRecordId: doc.id || "local-doc",
        fieldName: editingFieldKey,
        originalValue: fieldObj.value,
        correctedValue: editForm.correctedValue,
        reason: editForm.reason,
        userName: editForm.userName,
        approvedBy: editForm.approvedBy || undefined,
      });

      await InvoiceCorrectionService.persistCorrection({
        invoiceRecordId: doc.id || "local-doc",
        fieldName: editingFieldKey,
        originalValue: fieldObj.value,
        correctedValue: editForm.correctedValue,
        reason: editForm.reason,
        userName: editForm.userName,
        approvedBy: editForm.approvedBy || undefined,
      });

      setDoc(updatedDoc);
      setEditingFieldKey(null);
      toast.success(`Field "${String(editingFieldKey)}" corrected & logged to audit register.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to apply field correction");
    }
  };

  const handleTransition = (targetState: InvoiceLifecycleState) => {
    try {
      const nextState = InvoiceLifecycleService.transitionState(currentState, targetState);
      const updatedDoc = {
        ...doc,
        lifecycle_state: nextState,
      };
      setDoc(updatedDoc);
      if (onStateChange) onStateChange(nextState);
      toast.success(`Invoice lifecycle transitioned to ${InvoiceLifecycleService.getStateLabel(nextState)}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const renderConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          {(confidence * 100).toFixed(0)}% High
        </span>
      );
    } else if (confidence >= 0.7) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          {(confidence * 100).toFixed(0)}% Medium
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          {(confidence * 100).toFixed(0)}% Needs Review
        </span>
      );
    }
  };

  const renderFieldRow = (fieldKey: keyof ExtractedInvoiceDocument, label: string) => {
    const field = doc[fieldKey] as ExtractedField<any>;
    if (!field || typeof field !== "object" || !("field_name" in field)) return null;

    return (
      <tr
        key={field.field_name}
        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
      >
        <td className="py-3 px-4 font-medium text-sm text-gray-900 dark:text-gray-100">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            <button
              onClick={() => setDrillDownTarget({ fieldName: String(fieldKey), label, field })}
              title="Drill down trace: Source PDF -> Extraction -> Determinant -> Recon"
              className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center justify-between group">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {String(field.value ?? "") || (
                <span className="text-gray-400 italic">Not extracted</span>
              )}
              {field.unit && field.unit !== "text" && (
                <span className="ml-1 text-xs text-gray-500">{field.unit}</span>
              )}
            </span>
            <button
              onClick={() => handleOpenEditModal(fieldKey, field)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity"
              title="Correct value with audit logging"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
        <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
          Page {field.source_page}
        </td>
        <td
          className="py-3 px-4 text-xs text-gray-400 font-mono truncate max-w-xs"
          title={field.source_text_reference}
        >
          {field.source_text_reference || "N/A"}
        </td>
        <td className="py-3 px-4 text-right">{renderConfidenceBadge(field.confidence_score)}</td>
      </tr>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Workspace Header & Lifecycle Stepper */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Invoice Review: {doc.invoice_number.value || doc.metadata.source_filename}
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${InvoiceLifecycleService.getStateBadgeStyle(currentState)}`}>
                {InvoiceLifecycleService.getStateLabel(currentState)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Account: <strong className="text-gray-800 dark:text-gray-200">{doc.account_number.value}</strong> | Customer: <strong className="text-gray-800 dark:text-gray-200">{doc.customer_name.value}</strong> | SHA-256:{" "}
              <code className="font-mono text-xs text-gray-600 dark:text-gray-300">
                {doc.metadata.sha256_hash.substring(0, 16)}...
              </code>
            </p>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {currentState === "EXTRACTED" && (
              <button
                onClick={() => handleTransition("VALIDATED")}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                Validate Invoice
              </button>
            )}

            {(currentState === "VALIDATED" || currentState === "REVIEW_REQUIRED") && (
              <button
                onClick={() => handleTransition("APPROVED")}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                Approve Invoice
              </button>
            )}

            {currentState === "APPROVED" && (
              <button
                onClick={() => handleTransition("READY_FOR_RECONCILIATION")}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-sm transition-colors"
              >
                Queue for Reconciliation
              </button>
            )}

            <button
              onClick={() => onApprove(doc)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" /> Save & Finalize Record
            </button>
          </div>
        </div>

        {/* 10-State Visual Stepper */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 overflow-x-auto">
          <div className="flex items-center min-w-max space-x-2 text-xs">
            {InvoiceLifecycleService.LIFECYCLE_STATES.map((state, idx) => {
              const isActive = currentState === state;
              const isPast = InvoiceLifecycleService.LIFECYCLE_STATES.indexOf(currentState) > idx;

              return (
                <React.Fragment key={state}>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white font-bold shadow-xs"
                        : isPast
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                  >
                    <span>{idx + 1}.</span>
                    <span>{InvoiceLifecycleService.getStateLabel(state)}</span>
                  </div>
                  {idx < InvoiceLifecycleService.LIFECYCLE_STATES.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Validation Alert Banner */}
        {doc.validation_summary.discrepancies.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Validation Discrepancies Flagged ({doc.validation_summary.discrepancies.length})
                </h4>
                <ul className="mt-1 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                  {doc.validation_summary.discrepancies.map((disc, idx) => (
                    <li key={idx}>
                      • [{disc.rule_name}] {disc.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900 overflow-x-auto">
        <button
          onClick={() => setActiveTab("header")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "header"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Header & Account
        </button>
        <button
          onClick={() => setActiveTab("energy")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "energy"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Energy & Demand Determinants
        </button>
        <button
          onClick={() => setActiveTab("financial")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "financial"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Financial Totals
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "items"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Line Items ({doc.line_items.length})
        </button>
        <button
          onClick={() => setActiveTab("discrepancies")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "discrepancies"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Validation ({doc.validation_summary.discrepancies.length})
        </button>
        <button
          onClick={() => setActiveTab("audit_log")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "audit_log"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <History className="w-4 h-4" /> Audit Log ({(doc.corrections_log || []).length})
        </button>
      </div>

      {/* Tab Content Table */}
      <div className="overflow-x-auto p-6">
        {activeTab === "header" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-2 px-4">Field Name</th>
                <th className="py-2 px-4">Extracted Value</th>
                <th className="py-2 px-4">Source Page</th>
                <th className="py-2 px-4">Source Text Reference</th>
                <th className="py-2 px-4 text-right">Confidence Score</th>
              </tr>
            </thead>
            <tbody>
              {renderFieldRow("account_number", "Account Number")}
              {renderFieldRow("customer_name", "Customer Name")}
              {renderFieldRow("premise_id", "Premise ID")}
              {renderFieldRow("meter_number", "Meter Number")}
              {renderFieldRow("invoice_number", "Invoice Number")}
              {renderFieldRow("billing_period_start", "Billing Start Date")}
              {renderFieldRow("billing_period_end", "Billing End Date")}
              {renderFieldRow("invoice_date", "Invoice Date")}
              {renderFieldRow("tariff_name", "Tariff Name")}
              {renderFieldRow("tariff_code", "Tariff Code")}
            </tbody>
          </table>
        )}

        {activeTab === "energy" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-2 px-4">Determinant</th>
                <th className="py-2 px-4">Value</th>
                <th className="py-2 px-4">Source Page</th>
                <th className="py-2 px-4">Source Text Reference</th>
                <th className="py-2 px-4 text-right">Confidence Score</th>
              </tr>
            </thead>
            <tbody>
              {renderFieldRow("notified_maximum_demand", "Notified Maximum Demand (NMD)")}
              {renderFieldRow("utilised_capacity", "Utilised Capacity")}
              {renderFieldRow("maximum_demand", "Maximum Demand (kVA)")}
              {renderFieldRow("active_energy", "Active Energy (kWh)")}
              {renderFieldRow("peak_kwh", "Peak kWh")}
              {renderFieldRow("standard_kwh", "Standard kWh")}
              {renderFieldRow("off_peak_kwh", "Off-Peak kWh")}
              {renderFieldRow("total_kwh", "Total kWh")}
              {renderFieldRow("reactive_energy_kvarh", "Reactive Energy (kVARh)")}
              {renderFieldRow("power_factor", "Power Factor")}
            </tbody>
          </table>
        )}

        {activeTab === "financial" && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-2 px-4">Financial Header Item</th>
                <th className="py-2 px-4">Amount (ZAR)</th>
                <th className="py-2 px-4">Source Page</th>
                <th className="py-2 px-4">Source Text Reference</th>
                <th className="py-2 px-4 text-right">Confidence Score</th>
              </tr>
            </thead>
            <tbody>
              {renderFieldRow("demand_charges", "Demand Charges")}
              {renderFieldRow("network_charges", "Network Charges")}
              {renderFieldRow("capacity_charges", "Capacity Charges")}
              {renderFieldRow("service_charges", "Service Charges")}
              {renderFieldRow("reliability_services", "Reliability Services")}
              {renderFieldRow("levies", "Levies")}
              {renderFieldRow("adjustments", "Adjustments")}
              {renderFieldRow("subtotal_amount", "Subtotal (Excl. VAT)")}
              {renderFieldRow("vat_amount", "VAT (15%)")}
              {renderFieldRow("total_invoice_amount", "Total Invoice Amount (Incl. VAT)")}
              {renderFieldRow("opening_balance", "Opening Balance")}
              {renderFieldRow("closing_balance", "Closing Balance")}
              {renderFieldRow("payments", "Payments Received")}
              {renderFieldRow("credits", "Credits Applied")}
              {renderFieldRow("other_charges", "Other Charges")}
            </tbody>
          </table>
        )}

        {activeTab === "items" && (
          <div>
            {doc.line_items.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">
                No itemized line items detected in table grid.
              </p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-2 px-4">#</th>
                    <th className="py-2 px-4">Charge Description</th>
                    <th className="py-2 px-4">Rate</th>
                    <th className="py-2 px-4">Quantity</th>
                    <th className="py-2 px-4">Invoiced Amount</th>
                    <th className="py-2 px-4 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.line_items.map((item) => (
                    <tr
                      key={item.line_item_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-3 px-4 text-sm text-gray-500">{item.line_item_number}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.charge_label}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                        {item.rate.value} {item.rate.unit}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                        {item.quantity.value} {item.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        R {Number(item.invoiced_amount.value).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {renderConfidenceBadge(item.confidence_score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "discrepancies" && (
          <div>
            {doc.validation_summary.discrepancies.length === 0 ? (
              <div className="p-6 text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold text-sm">
                  All mathematical & domain validation rules passed cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {doc.validation_summary.discrepancies.map((disc, idx) => (
                  <div
                    key={idx}
                    className="p-4 border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                        [{disc.rule_id}] {disc.rule_name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-xs font-medium uppercase bg-amber-200 text-amber-900">
                        {disc.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                      {disc.message}
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-900 flex gap-6 text-xs text-amber-700 dark:text-amber-400">
                      <span>
                        Expected: <strong>{disc.expected_value}</strong>
                      </span>
                      <span>
                        Actual Extracted: <strong>{disc.actual_value}</strong>
                      </span>
                      {disc.variance_amount && (
                        <span>
                          Variance: <strong>{disc.variance_amount.toFixed(2)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "audit_log" && (
          <div>
            {!doc.corrections_log || doc.corrections_log.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/50 rounded-lg">
                <History className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="font-medium text-sm">No human corrections recorded for this document yet.</p>
                <p className="text-xs text-gray-400 mt-1">All manual edits are captured here in an append-only audit trail.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-2 px-4">Timestamp</th>
                    <th className="py-2 px-4">Field Name</th>
                    <th className="py-2 px-4">Original Extracted</th>
                    <th className="py-2 px-4">Corrected Value</th>
                    <th className="py-2 px-4">Audit Reason</th>
                    <th className="py-2 px-4">User</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.corrections_log.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4 text-xs font-mono text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {entry.field_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-red-600 dark:text-red-400 line-through">
                        {String(entry.original_value)}
                      </td>
                      <td className="py-3 px-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {String(entry.corrected_value)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 italic">
                        "{entry.reason}"
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">
                        {entry.user_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Audit Correction Modal */}
      {editingFieldKey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" /> Audit Correction: {String(editingFieldKey)}
              </h3>
              <button
                onClick={() => setEditingFieldKey(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Original Extracted Value (Immutable)
                </label>
                <input
                  type="text"
                  disabled
                  value={String((doc[editingFieldKey] as ExtractedField<any>)?.value ?? "")}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Corrected Value *
                </label>
                <input
                  type="text"
                  value={editForm.correctedValue}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, correctedValue: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter corrected value"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Audit Reason for Change (Required) *
                </label>
                <textarea
                  rows={3}
                  value={editForm.reason}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Explain why this field is being edited for compliance..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Reviewer Name
                  </label>
                  <input
                    type="text"
                    value={editForm.userName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, userName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Approved By (Optional)
                  </label>
                  <input
                    type="text"
                    value={editForm.approvedBy}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, approvedBy: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
                    placeholder="Supervisor name"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-gray-800">
              <button
                onClick={() => setEditingFieldKey(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCorrection}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Save Audit Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Evidence Navigation Modal */}
      {drillDownTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" /> End-to-End Evidence Lineage: {drillDownTarget.label}
              </h3>
              <button
                onClick={() => setDrillDownTarget(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breadcrumb Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">1. Source File & Page</span>
                <p className="text-gray-700 dark:text-gray-300">{doc.metadata.source_filename} (Page {drillDownTarget.field.source_page})</p>
                <p className="text-gray-500 font-mono text-2xs mt-1 truncate">Hash: {doc.metadata.sha256_hash}</p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">2. Raw Extracted Snippet</span>
                <p className="text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-800">
                  "{drillDownTarget.field.source_text_reference || 'N/A'}"
                </p>
                <p className="text-gray-500 mt-1">Confidence Score: {(drillDownTarget.field.confidence_score * 100).toFixed(0)}%</p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">3. Normalized Billing Determinant</span>
                <p className="text-gray-900 dark:text-gray-100 font-bold text-sm">
                  {String(drillDownTarget.field.value)} {drillDownTarget.field.unit}
                </p>
                <p className="text-gray-500 mt-1">Parser Engine: {drillDownTarget.field.parser_version}</p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">4. Reconciliation Determinant Status</span>
                <p className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Ready for Audit Match
                </p>
                <p className="text-gray-500 mt-1">Lifecycle State: {doc.lifecycle_state || 'EXTRACTED'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t dark:border-gray-800">
              <button
                onClick={() => setDrillDownTarget(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Close Lineage View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
