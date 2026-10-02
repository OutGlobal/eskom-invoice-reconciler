/**
 * STAGE 18 — REAL DOCUMENT TEST FIXTURES
 * ========================================================
 * Provides real binary PDF byte generators for all 10 required document types:
 * 1. Native text PDF
 * 2. Scanned PDF (raster image XObject, zero text stream)
 * 3. Multi-page PDF (3+ structured pages with page markers)
 * 4. Invoice containing tables (tabular billing schedule)
 * 5. Invoice containing TOU energy data (Peak/Standard/Off-Peak breakdown)
 * 6. Poor-quality PDF (smudged/unreadable OCR artifacts, missing determinants)
 * 7. Corrupted PDF (corrupt magic header / truncated binary)
 * 8. Password-protected PDF (encrypted stream with /Encrypt dictionary)
 * 9. Duplicate PDF (cryptographically identical payload for idempotency)
 * 10. Large PDF (1+ MB payload to test throughput & memory boundaries)
 *
 * All data in this file is strictly isolated under /fixtures for testing purposes only.
 */

/**
 * Escapes characters for PDF literal text strings.
 */
function escapePdfText(text: string): string {
  return text.replace(/[()\\]/g, "\\$&");
}

/**
 * 1. Native text PDF
 * High-quality vector PDF with clean embedded digital text operators (/F1 Tf, Tj).
 */
export function createNativeTextPdfBytes(): Uint8Array {
  const lines = [
    "ESKOM HOLDINGS SOC LIMITED",
    "TAX INVOICE / STATEMENT",
    "ACCOUNT NUMBER: 1234567890",
    "INVOICE NUMBER: INV-2024-001",
    "BILLING PERIOD: 01/03/2024 TO 31/03/2024",
    "SUPPLY ADDRESS: PORTION 12 FARM DRIEFONTEIN, GAUTENG",
    "TARIFF: MEGAFLEX RURAL ACTIVE",
    "TOTAL ENERGY CONSUMPTION: 45,820.00 kWh",
    "MAXIMUM DEMAND: 124.50 kVA",
    "ENERGY CHARGES: R 98,513.00",
    "NETWORK CAPACITY CHARGE: R 18,675.00",
    "BASIC CHARGE: R 4,250.00",
    "SUBTOTAL: R 163,000.22",
    "VAT (15%): R 24,450.03",
    "TOTAL AMOUNT DUE: R 187,450.25",
    "METER SPECIFICATION & READINGS",
    "METER NUMBER: MTR-98765432",
    "MULTIPLYING FACTOR: 120.00",
    "CONSUMPTION: 45,820.00 kWh",
  ];

  const streamBody = `BT
/F1 12 Tf
72 712 Td
${lines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n")}
ET`;

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000213 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamBody.length + 350}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 2. Scanned PDF
 * Image-only raster PDF containing an XObject Image and ZERO digital text operators.
 */
export function createScannedPdfBytes(): Uint8Array {
  // Raw 100x100 RGB dummy bitmap bytes
  const rawImageBytes = new Uint8Array(600);
  for (let i = 0; i < rawImageBytes.length; i++) {
    rawImageBytes[i] = (i * 7) % 256;
  }
  const rawImageAscii = Array.from(rawImageBytes)
    .map((b) => String.fromCharCode(b))
    .join("");

  const pageStream = `q
595 0 0 842 0 0 cm
/Im1 Do
Q`;

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${pageStream.length} >>
stream
${pageStream}
endstream
endobj
5 0 obj
<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /BitsPerComponent 8 /ColorSpace /DeviceRGB /Length ${rawImageAscii.length} >>
stream
${rawImageAscii}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000245 00000 n 
0000000340 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${pageStream.length + rawImageAscii.length + 500}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 3. Multi-page PDF
 * Structured multi-page PDF with 3 distinct pages, individual text streams, and pagination markers.
 */
export function createMultiPagePdfBytes(pageCount = 3): Uint8Array {
  const pageContents: string[] = [
    // Page 1: Executive invoice summary
    [
      "ESKOM HOLDINGS SOC LIMITED - TAX INVOICE",
      "PAGE 1 OF 3 (ACCOUNT SUMMARY)",
      "ACCOUNT NUMBER: 1234567890",
      "INVOICE NUMBER: INV-2024-001",
      "BILLING PERIOD: 01/03/2024 TO 31/03/2024",
      "TOTAL AMOUNT DUE: R 187,450.25",
    ].join("\n"),

    // Page 2: Meter readings & consumption determinants
    [
      "ESKOM HOLDINGS SOC LIMITED - TAX INVOICE",
      "PAGE 2 OF 3 (METER READINGS & DEMAND)",
      "METER NUMBER: MTR-98765432",
      "PREVIOUS READING: 104,200.00",
      "CURRENT READING: 150,020.00",
      "TOTAL ENERGY CONSUMPTION: 45,820.00 kWh",
      "MAXIMUM DEMAND: 124.50 kVA",
    ].join("\n"),

    // Page 3: Tariff specification & banking details
    [
      "ESKOM HOLDINGS SOC LIMITED - TAX INVOICE",
      "PAGE 3 OF 3 (TARIFF SCHEDULE & PAYMENT)",
      "TARIFF: MEGAFLEX RURAL ACTIVE",
      "VAT REGISTRATION NO: 4740101508",
      "BANK: STANDARD BANK OF SA",
      "ACCOUNT TYPE: CHEQUE",
      "PAYMENT DUE DATE: 25/04/2024",
    ].join("\n"),
  ];

  let objects = "";
  let objIndex = 4;
  const pageObjRefs: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const textLines = (pageContents[i] || `PAGE ${i + 1} OF ${pageCount}`).split("\n");
    const streamBody = `BT\n/F1 12 Tf\n72 712 Td\n${textLines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n")}\nET`;

    const pageObjId = objIndex++;
    const streamObjId = objIndex++;
    pageObjRefs.push(`${pageObjId} 0 R`);

    objects += `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${streamObjId} 0 R >>\nendobj\n`;
    objects += `${streamObjId} 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`;
  }

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [${pageObjRefs.join(" ")}] /Count ${pageCount} >>
endobj
${objects}
xref
0 ${objIndex}
0000000000 65535 f 
trailer
<< /Size ${objIndex} /Root 1 0 R >>
startxref
${objects.length + 400}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 4. Invoice containing tables
 * Formats a columnar Eskom billing schedule table with column headers, aligned rows, and totals.
 */
export function createTableInvoicePdfBytes(): Uint8Array {
  const tableLines = [
    "ESKOM HOLDINGS SOC LIMITED - TAX INVOICE",
    "ACCOUNT NUMBER: 1234567890",
    "INVOICE NUMBER: INV-2024-001",
    "BILLING PERIOD: 01/03/2024 TO 31/03/2024",
    "TARIFF: MEGAFLEX RURAL",
    "---------------------------------------------------------------------------------------------",
    "ITEM | CHARGE DESCRIPTION           | CONSUMPTION | UNIT RATE    | AMOUNT (EXCL VAT)",
    "---------------------------------------------------------------------------------------------",
    "01   | Peak Active Energy           | 12,500 kWh  | 666.92 c/kWh | R 83,365.00",
    "02   | Standard Active Energy       | 22,100 kWh  | 215.40 c/kWh | R 47,603.40",
    "03   | Off-Peak Active Energy       | 11,220 kWh  | 111.15 c/kWh | R 12,471.03",
    "04   | Network Capacity Charge      | 124.50 kVA  | R 150.00/kVA | R 18,675.00",
    "05   | Basic Daily Charge           | 31 Days     | R 137.10/day | R 4,250.10",
    "---------------------------------------------------------------------------------------------",
    "SUBTOTAL: R 166,364.53",
    "VAT (15%): R 24,954.68",
    "TOTAL AMOUNT DUE: R 191,319.21",
    "TOTAL ENERGY CONSUMPTION: 45,820.00 kWh",
    "MAXIMUM DEMAND: 124.50 kVA",
    "METER NUMBER: MTR-98765432",
  ];

  const streamBody = `BT
/F1 10 Tf
50 750 Td
${tableLines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n")}
ET`;

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamBody.length + 350}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 5. Invoice containing TOU energy data
 * Explicitly breaks down Eskom Time-Of-Use billing components: Peak, Standard, and Off-Peak.
 */
export function createTouInvoicePdfBytes(): Uint8Array {
  const touLines = [
    "ESKOM HOLDINGS SOC LIMITED - TAX INVOICE",
    "ACCOUNT NUMBER: 1234567890",
    "INVOICE NUMBER: INV-2024-001",
    "BILLING PERIOD: 01/03/2024 TO 31/03/2024",
    "TARIFF: MEGAFLEX RURAL",
    "TIME OF USE (TOU) ENERGY BREAKDOWN",
    "PEAK CONSUMPTION: 12,500.00 kWh",
    "STANDARD CONSUMPTION: 22,100.00 kWh",
    "OFF-PEAK CONSUMPTION: 11,220.00 kWh",
    "TOTAL ENERGY CONSUMPTION: 45,820.00 kWh",
    "PEAK ENERGY CHARGE: R 83,365.00",
    "STANDARD ENERGY CHARGE: R 47,603.40",
    "OFF-PEAK ENERGY CHARGE: R 12,471.03",
    "MAXIMUM DEMAND: 124.50 kVA",
    "NETWORK DEMAND CHARGE: R 18,675.00",
    "SUBTOTAL: R 162,114.43",
    "VAT (15%): R 24,317.16",
    "TOTAL AMOUNT DUE: R 186,431.59",
    "METER NUMBER: MTR-98765432",
  ];

  const streamBody = `BT
/F1 11 Tf
72 720 Td
${touLines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n")}
ET`;

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamBody.length + 350}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 6. Poor-quality PDF
 * Degraded or incomplete document stream missing essential account and financial numbers.
 */
export function createPoorQualityPdfBytes(): Uint8Array {
  const degradedLines = [
    "ESK... ??? @#! HOLDINGS",
    "ACCOUNT: [ILLEGIBLE_SMUDGE_OR_BLUR]",
    "TAX INVOICE: 9#?$!?",
    "DATE: __/__/____",
    "TOTAL: ???.00",
    "METER: [UNREADABLE]",
  ];

  const streamBody = `BT
/F1 10 Tf
72 700 Td
${degradedLines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n")}
ET`;

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamBody.length + 350}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * 7. Corrupted PDF
 * Malformed binary stream lacking valid magic headers or truncated prematurely.
 */
export function createCorruptedPdfBytes(): Uint8Array {
  // Deliberately corrupted byte sequence missing %PDF- header and truncated mid-stream
  return new TextEncoder().encode(
    "NOT_A_VALID_PDF_HEADER\x00\x1f\x8b\x08corrupted_binary_stream_without_trailer",
  );
}

/**
 * 8. Password-protected PDF
 * Valid PDF containing an active /Encrypt dictionary object.
 */
export function createPasswordProtectedPdfBytes(): Uint8Array {
  const encryptedPdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 45 >>
stream
\x1e\xfa\x82\x90\x0c\x88\x12\x34\xaa\xbb\xcc\xdd\xee\xff\x11\x22\x33\x44\x55\x66\x77\x88\x99\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\x00\xaa\xbb\xcc\xdd\xee\xff\x11\x22\x33\x44
endstream
endobj
5 0 obj
<<
  /Filter /Standard
  /V 2
  /R 3
  /Length 128
  /P -1052
  /O (4b7890ef12345678abcdef0123456789)
  /U (9876543210fedcba876543210fedcba9)
>>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000213 00000 n 
0000000305 00000 n 
trailer
<<
  /Size 6
  /Root 1 0 R
  /Encrypt 5 0 R
>>
startxref
490
%%EOF`;

  return new TextEncoder().encode(encryptedPdf);
}

/**
 * 9. Duplicate PDF
 * Returns byte-for-byte identical content to createNativeTextPdfBytes to trigger cryptographic duplicate detection.
 */
export function createDuplicatePdfBytes(): Uint8Array {
  return createNativeTextPdfBytes();
}

/**
 * 10. Large PDF
 * Synthesizes a high-volume PDF (1+ MB) by expanding valid repetitive data streams.
 */
export function createLargePdfBytes(targetSizeKb = 1024): Uint8Array {
  const line =
    "DATA BLOCK ROW: Eskom Transmission and Distribution Reconciliation Telemetry Stream Verification.";
  const targetBytes = targetSizeKb * 1024;
  let streamData = "";
  let counter = 0;
  while (streamData.length < targetBytes) {
    streamData += `BT /F1 10 Tf 50 ${750 - (counter % 600)} Td (${escapePdfText(line)} #${counter}) Tj ET\n`;
    counter++;
  }

  const pdf = `%PDF-1.5
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamData.length} >>
stream
ACCOUNT NUMBER: 1234567890
INVOICE NUMBER: INV-2024-001
BILLING PERIOD: 01/03/2024 TO 31/03/2024
TARIFF: MEGAFLEX RURAL
TOTAL ENERGY CONSUMPTION: 45,820.00 kWh
MAXIMUM DEMAND: 124.50 kVA
TOTAL AMOUNT DUE: R 187,450.25
METER NUMBER: MTR-98765432
${streamData}
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${streamData.length + 450}
%%EOF`;

  return new TextEncoder().encode(pdf);
}
