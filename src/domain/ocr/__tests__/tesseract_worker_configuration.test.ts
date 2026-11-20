import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production scanned invoice OCR engine', () => {
  it('uses the locally deployed OCR worker and LSTM WASM core', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/domain/ocr/tesseractWorkerPool.ts'), 'utf8');
    expect(code).toContain('/tesseract/worker.min.js');
    expect(code).toContain('/tesseract/tesseract-core-lstm.wasm.js');
    expect(code).toContain('/tessdata');
  });
  it('does not silently replace failed recognition with a fake empty OCR result', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/domain/ocr/tesseractWorkerPool.ts'), 'utf8');
    expect(code).not.toContain('return this.executeHeuristicFallback(');
    expect(code).toContain('throw new Error(`OCR failed on page');
  });
  it('allows enough time for a dense 300dpi scanned utility invoice', () => {
    const config = readFileSync(resolve(process.cwd(), 'src/domain/ocr/ocrProviderConfig.ts'), 'utf8');
    expect(config).toContain('readEnvNumber("OCR_TIMEOUT_MS", 120_000)');
  });
});
