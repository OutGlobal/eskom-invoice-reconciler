import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('scanned invoice OCR assets', () => {
  it('pins the browser worker to the shipped LSTM core rather than missing SIMD variants', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/pdfInvoice.ts'), 'utf8');
    expect(source).toContain('/tesseract/tesseract-core-lstm.wasm.js');
    expect(source).not.toMatch(/corePath:\s*origin\s*\?\s*`\$\{origin\}\/tesseract`/);
    for (const file of ['tesseract/worker.min.js', 'tesseract/tesseract-core-lstm.wasm.js', 'tesseract/tesseract-core-lstm.wasm', 'tessdata/eng.traineddata.gz']) {
      expect(existsSync(resolve(process.cwd(), 'public', file)), `${file} must be shipped`).toBe(true);
    }
  });
});
