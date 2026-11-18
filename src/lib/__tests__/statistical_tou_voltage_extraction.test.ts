import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { SpreadsheetInvoiceExtractor } from "../../domain/invoice/spreadsheetInvoiceExtractor";

function workbook(sheetName: string, explicitVoltage?: string) {
  const rows: (string | number)[][] = [
    ["Account:", "Example Customer"], ["Code:", 12345],
    ["Start Date:", "2026-01-17"], ["End Date:", "2026-02-16"],
    ["Interval:", 30], ["Tariff:", "MEGAFLEX/MINIFLEX"],
    ...(explicitVoltage ? [["Supply Voltage:", explicitVoltage]] : []),
    ...Array.from({ length: 16 }, () => ["", ""]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return SpreadsheetInvoiceExtractor.extractStatisticalTouWorkbook(wb, "example.xlsx", "voltage-regression");
}

for (const [name, explicit, expected] of [
  ["Millenium 33kV Feb 2026", undefined, "33 kV"],
  ["Millenium 33kV - Apr 2026", undefined, "33 kV"],
  ["Millenium 11 kV May 2026", undefined, "11 kV"],
  ["Millenium 33kV Feb 2026", "22 kV", "22 kV"],
  ["Millenium Feb 2026", undefined, ""],
] as const) {
  const result = workbook(name, explicit);
  assert.equal(result.success, true, `Extract ${name}`);
  assert.equal(result.extractedFields?.voltage, expected, `Voltage ${name}`);
}
console.log("Statistical TOU voltage extraction regression tests passed (5 cases)");
