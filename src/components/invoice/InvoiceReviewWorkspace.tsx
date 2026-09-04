/**
 * Invoice Review Workspace Component
 * Human-in-the-loop interactive review & correction interface for utility invoices
 */

import React, { useState } from 'react';
import type { ExtractedInvoiceDocument, ExtractedField } from '../../domain/invoice/types';
import { CheckCircle2, AlertTriangle, AlertCircle, Edit2, Save, FileText, Check, ShieldAlert } from 'lucide-react';

interface InvoiceReviewWorkspaceProps {
  document: ExtractedInvoiceDocument;
  onApprove: (updatedDocument: ExtractedInvoiceDocument) => void;
  onCancel?: () => void;
}

export const InvoiceReviewWorkspace: React.FC<InvoiceReviewWorkspaceProps> = ({
  document: initialDoc,
  onApprove,
  onCancel,
}) => {
  const [doc, setDoc] = useState<ExtractedInvoiceDocument>(initialDoc);
  const [activeTab, setActiveTab] = useState<'header' | 'energy' | 'financial' | 'items' | 'discrepancies'>('header');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (field: ExtractedField<any>) => {
    setEditingField(field.field_name);
    setEditValue(String(field.value ?? ''));
  };

  const handleSaveField = (fieldName: keyof ExtractedInvoiceDocument) => {
    const target = doc[fieldName] as ExtractedField<any>;
    if (!target) return;

    const isNum = typeof target.value === 'number';
    const parsedVal = isNum ? parseFloat(editValue) || 0 : editValue;

    const updatedField: ExtractedField<any> = {
      ...target,
      value: parsedVal,
      confidence_score: 1.0, // Set to 1.0 upon human edit
      source_text_reference: `Human edited: ${target.source_text_reference}`,
    };

    const updatedDoc = {
      ...doc,
      [fieldName]: updatedField,
    };

    // Re-evaluate low confidence flags
    const lowConf = updatedDoc.metadata.low_confidence_fields.filter((f) => f !== fieldName);
    updatedDoc.metadata.low_confidence_fields = lowConf;
    if (lowConf.length === 0 && updatedDoc.validation_summary.status !== 'failed') {
      updatedDoc.metadata.needs_human_review = false;
    }

    setDoc(updatedDoc);
    setEditingField(null);
  };

  const renderConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          {(confidence * 100).toFixed(0)}% High
        </span>
      );
    } else if (confidence >= 0.70) {
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
    if (!field || typeof field !== 'object' || !('field_name' in field)) return null;

    const isEditing = editingField === field.field_name;

    return (
      <tr key={field.field_name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
        <td className="py-3 px-4 font-medium text-sm text-gray-900 dark:text-gray-100">{label}</td>
        <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => handleSaveField(fieldKey)}
                className="p-1 text-emerald-600 hover:text-emerald-700 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {String(field.value ?? '') || <span className="text-gray-400 italic">Not extracted</span>}
                {field.unit && field.unit !== 'text' && <span className="ml-1 text-xs text-gray-500">{field.unit}</span>}
              </span>
              <button
                onClick={() => handleStartEdit(field)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
          Page {field.source_page}
        </td>
        <td className="py-3 px-4 text-xs text-gray-400 font-mono truncate max-w-xs" title={field.source_text_reference}>
          {field.source_text_reference || 'N/A'}
        </td>
        <td className="py-3 px-4 text-right">{renderConfidenceBadge(field.confidence_score)}</td>
      </tr>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Workspace Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Invoice Review: {doc.invoice_number.value || doc.metadata.source_filename}
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              SHA-256: <code className="font-mono text-xs text-gray-600 dark:text-gray-300">{doc.metadata.sha256_hash.substring(0, 16)}...</code> | Document Type: <span className="font-medium text-gray-700 dark:text-gray-300">{doc.metadata.document_type}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {doc.metadata.needs_human_review ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Needs Review ({doc.metadata.low_confidence_fields.length} low-confidence fields)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified High Confidence
              </span>
            )}

            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
              >
                Cancel
              </button>
            )}

            <button
              onClick={() => onApprove(doc)}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" /> Approve & Finalize Invoice
            </button>
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
                    <li key={idx}>• [{disc.rule_name}] {disc.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900">
        <button
          onClick={() => setActiveTab('header')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'header'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Header & Account
        </button>
        <button
          onClick={() => setActiveTab('energy')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'energy'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Energy & Demand Determinants
        </button>
        <button
          onClick={() => setActiveTab('financial')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'financial'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Financial Totals
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Line Items ({doc.line_items.length})
        </button>
        <button
          onClick={() => setActiveTab('discrepancies')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'discrepancies'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Validation ({doc.validation_summary.discrepancies.length})
        </button>
      </div>

      {/* Tab Content Table */}
      <div className="overflow-x-auto p-6">
        {activeTab === 'header' && (
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
              {renderFieldRow('account_number', 'Account Number')}
              {renderFieldRow('customer_name', 'Customer Name')}
              {renderFieldRow('premise_id', 'Premise ID')}
              {renderFieldRow('meter_number', 'Meter Number')}
              {renderFieldRow('invoice_number', 'Invoice Number')}
              {renderFieldRow('billing_period_start', 'Billing Start Date')}
              {renderFieldRow('billing_period_end', 'Billing End Date')}
              {renderFieldRow('invoice_date', 'Invoice Date')}
              {renderFieldRow('tariff_name', 'Tariff Name')}
              {renderFieldRow('tariff_code', 'Tariff Code')}
            </tbody>
          </table>
        )}

        {activeTab === 'energy' && (
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
              {renderFieldRow('notified_maximum_demand', 'Notified Maximum Demand (NMD)')}
              {renderFieldRow('utilised_capacity', 'Utilised Capacity')}
              {renderFieldRow('maximum_demand', 'Maximum Demand (kVA)')}
              {renderFieldRow('active_energy', 'Active Energy (kWh)')}
              {renderFieldRow('peak_kwh', 'Peak kWh')}
              {renderFieldRow('standard_kwh', 'Standard kWh')}
              {renderFieldRow('off_peak_kwh', 'Off-Peak kWh')}
              {renderFieldRow('total_kwh', 'Total kWh')}
              {renderFieldRow('reactive_energy_kvarh', 'Reactive Energy (kVARh)')}
              {renderFieldRow('power_factor', 'Power Factor')}
            </tbody>
          </table>
        )}

        {activeTab === 'financial' && (
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
              {renderFieldRow('demand_charges', 'Demand Charges')}
              {renderFieldRow('network_charges', 'Network Charges')}
              {renderFieldRow('capacity_charges', 'Capacity Charges')}
              {renderFieldRow('service_charges', 'Service Charges')}
              {renderFieldRow('reliability_services', 'Reliability Services')}
              {renderFieldRow('levies', 'Levies')}
              {renderFieldRow('adjustments', 'Adjustments')}
              {renderFieldRow('subtotal_amount', 'Subtotal (Excl. VAT)')}
              {renderFieldRow('vat_amount', 'VAT (15%)')}
              {renderFieldRow('total_invoice_amount', 'Total Invoice Amount (Incl. VAT)')}
              {renderFieldRow('opening_balance', 'Opening Balance')}
              {renderFieldRow('closing_balance', 'Closing Balance')}
              {renderFieldRow('payments', 'Payments Received')}
              {renderFieldRow('credits', 'Credits Applied')}
              {renderFieldRow('other_charges', 'Other Charges')}
            </tbody>
          </table>
        )}

        {activeTab === 'items' && (
          <div>
            {doc.line_items.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No itemized line items detected in table grid.</p>
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
                    <tr key={item.line_item_number} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4 text-sm text-gray-500">{item.line_item_number}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">{item.charge_label}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{item.rate.value} {item.rate.unit}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{item.quantity.value} {item.unit_of_measure}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">R {Number(item.invoiced_amount.value).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">{renderConfidenceBadge(item.confidence_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'discrepancies' && (
          <div>
            {doc.validation_summary.discrepancies.length === 0 ? (
              <div className="p-6 text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold text-sm">All mathematical & domain validation rules passed cleanly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {doc.validation_summary.discrepancies.map((disc, idx) => (
                  <div key={idx} className="p-4 border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">[{disc.rule_id}] {disc.rule_name}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-medium uppercase bg-amber-200 text-amber-900">
                        {disc.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{disc.message}</p>
                    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-900 flex gap-6 text-xs text-amber-700 dark:text-amber-400">
                      <span>Expected: <strong>{disc.expected_value}</strong></span>
                      <span>Actual Extracted: <strong>{disc.actual_value}</strong></span>
                      {disc.variance_amount && <span>Variance: <strong>{disc.variance_amount.toFixed(2)}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
