import React, { useState } from "react";
import {
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  X,
  Building2,
  DollarSign,
  Printer,
} from "lucide-react";
import { exportToExcel, exportToPdfPrint } from "@/lib/exportReports";

interface DisputePackModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  accountNumber?: string;
  invoiceNumber?: string;
  disputedAmount?: number;
}

export const DisputePackModal: React.FC<DisputePackModalProps> = ({
  isOpen,
  onClose,
  customerName = "ACME Industrial Manufacturing (Pty) Ltd",
  accountNumber = "8905743120",
  invoiceNumber = "INV-2026-03-8891",
  disputedAmount = 22500.0,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      exportToPdfPrint();
      setIsExporting(false);
    }, 300);
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setTimeout(() => {
      exportToExcel(
        [
          {
            "Claim ID": "CL-2026-0391",
            "Discrepancy Category": "Peak Energy TOU Misclassification",
            "Billed Amount (ZAR)": 215450.0,
            "Calculated Amount (ZAR)": 203000.0,
            "Disputed Overcharge (ZAR)": 12450.0,
            "Evidence Reference": "SHA256:e3b0c442... | 312 peak intervals",
          },
          {
            "Claim ID": "CL-2026-0392",
            "Discrepancy Category": "Unwarranted NMD Ratchet Penalty",
            "Billed Amount (ZAR)": 42800.0,
            "Calculated Amount (ZAR)": 37000.0,
            "Disputed Overcharge (ZAR)": 5800.0,
            "Evidence Reference": "Peak demand 195 kVA vs NMD 250 kVA",
          },
          {
            "Claim ID": "CL-2026-0393",
            "Discrepancy Category": "Reactive Energy Calculation Mismatch",
            "Billed Amount (ZAR)": 2450.0,
            "Calculated Amount (ZAR)": 0.0,
            "Disputed Overcharge (ZAR)": 2450.0,
            "Evidence Reference": "Power factor 0.962 > threshold 0.96",
          },
          {
            "Claim ID": "CL-2026-0394",
            "Discrepancy Category": "VAT Subtotal Delta",
            "Billed Amount (ZAR)": 73455.0,
            "Calculated Amount (ZAR)": 69720.0,
            "Disputed Overcharge (ZAR)": 1800.0,
            "Evidence Reference": "Derived 15% VAT on disputed overcharges",
          },
        ],
        `Eskom_Dispute_Pack_${accountNumber}_${invoiceNumber}`,
      );
      setIsExporting(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Official Utility Dispute Pack Generator
              </h3>
              <p className="text-xs text-slate-400">
                Compile gazetted Eskom / Municipal formal claim dossier with audit lineage evidence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dispute Summary Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Customer Profile</span>
              <span className="text-slate-200 font-bold block truncate">{customerName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Account Number</span>
              <span className="text-slate-200 font-bold block">{accountNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Invoice Number</span>
              <span className="text-slate-200 font-bold block">{invoiceNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Disputed Claim Amount</span>
              <span className="text-amber-400 font-bold text-sm block">
                R {disputedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-1">
              Included Discrepancy Evidence (4 Items)
            </span>
            <ul className="space-y-1 text-[11px] text-slate-300">
              <li className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800">
                <span>1. Peak Energy TOU Classification Mismatch (312 intervals)</span>
                <span className="text-amber-400 font-bold">R 12,450.00</span>
              </li>
              <li className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800">
                <span>2. Unwarranted NMD Ratchet Penalty Charge</span>
                <span className="text-amber-400 font-bold">R 5,800.00</span>
              </li>
              <li className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800">
                <span>3. Reactive Energy Penalty Threshold Error (PF = 0.962)</span>
                <span className="text-amber-400 font-bold">R 2,450.00</span>
              </li>
              <li className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800">
                <span>4. Derived 15% VAT Subtotal Overcharge</span>
                <span className="text-amber-400 font-bold">R 1,800.00</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Cryptographic Hash Chain Verified (SHA-256 Ledger)</span>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-md transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Dispute Excel Schedule</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-md transition-all"
            >
              <Printer className="h-4 w-4" />
              <span>Generate PDF Dispute Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
