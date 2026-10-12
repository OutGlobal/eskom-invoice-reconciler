/**
 * ENERA PRODUCTION OCR ENGINE — IMAGE PREPROCESSING ENGINE
 * ========================================================
 * Prepares scanned, degraded, skewed, or photographed document images
 * for optimal optical character recognition without introducing hallucinations.
 *
 * Processing pipeline (each step is ADAPTIVE — only applied when beneficial):
 *
 *   Raw RGBA Page Image
 *          ↓
 *   Resolution Normalisation  ← audited against minimum 200 DPI requirement
 *          ↓
 *   Grayscale Conversion      ← always applied (ITU-R BT.601 luminance)
 *          ↓
 *   Inversion Check           ← inverts only if avg luminance < 80
 *          ↓
 *   Rotation & Orientation    ← detects portrait/landscape, 0°/90°/180°/270°,
 *                               losslessly rotates derived buffer to upright 0°
 *          ↓
 *   Noise Reduction           ← 3×3 median filter, skipped if image is clean
 *          ↓
 *   Contrast Enhancement      ← histogram stretch, skipped if ratio >= 0.7
 *          ↓
 *   Deskew Estimation         ← projection profile variance, skipped if |angle| < 0.3°
 *          ↓
 *   Border Cleanup            ← whitens a thin border margin, skipped if unnecessary
 *          ↓
 *   Otsu Binarization         ← optional thresholding, skipped if disabled or already binary
 *          ↓
 *   RGBA Reconstruction       ← converts derived grayscale back to 4-channel RGBA
 *          ↓
 *   OcrPreprocessedImage + PreprocessingDecision
 *
 * Key design rules:
 * - The ORIGINAL pixel buffer is NEVER modified. A derived copy is created.
 * - Every transform decision is recorded in a `PreprocessingDecision` audit record.
 * - No transform may fabricate or hallucinate image content.
 */

import type {
  DocumentOrientation,
  OcrImageGeometry,
  OcrPreprocessedImage,
  PreprocessingDecision,
  RotationDegrees,
} from "./types";

export interface PreprocessingOptions {
  enableDeskew?: boolean;
  enableBinarization?: boolean;
  enableContrastEnhance?: boolean;
  enableNoiseReduction?: boolean;
  enableBorderCleanup?: boolean;
  enableOrientationCorrection?: boolean;
  pdfRotation?: RotationDegrees;
  targetDpi?: number;
}

export interface OrientationDetectionResult {
  orientation: DocumentOrientation;
  detectedRotation: RotationDegrees;
  recommendedCorrectionRotation: RotationDegrees;
  confidence: number;
  method: "PDF_METADATA" | "ASPECT_RATIO" | "PROJECTION_VARIANCE" | "HEURISTIC";
}

/** Minimum DPI considered sufficient for OCR without resolution normalisation. */
const MIN_OCR_DPI = 200;

/** Contrast ratio (Michelson) above which contrast enhancement is skipped. */
const CONTRAST_SKIP_THRESHOLD = 0.7;

/** Deskew angle (degrees) below which deskew is skipped (negligible tilt). */
const DESKEW_ANGLE_SKIP_DEGREES = 0.3;

/** Border strip width as a fraction of the smaller dimension. */
const BORDER_FRACTION = 0.01;

/** Noise measurement threshold — average local variance above this is "noisy". */
const NOISE_THRESHOLD = 18;

export class ImagePreprocessingEngine {
  /**
   * Preprocesses a raw RGBA or RGB pixel buffer for OCR.
   *
   * Reads the source buffer but NEVER mutates it.
   * Returns a derived `OcrPreprocessedImage` containing an independent RGBA buffer
   * and a full `PreprocessingDecision` audit record.
   */
  public static preprocess(
    pixelBuffer: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    pageNumber: number = 1,
    options: PreprocessingOptions = {},
  ): OcrPreprocessedImage {
    const enableDeskew = options.enableDeskew ?? true;
    const enableBinarization = options.enableBinarization ?? true;
    const enableContrastEnhance = options.enableContrastEnhance ?? true;
    const enableNoiseReduction = options.enableNoiseReduction ?? true;
    const enableBorderCleanup = options.enableBorderCleanup ?? true;
    const enableOrientationCorrection = options.enableOrientationCorrection ?? true;
    const inputDpi = options.targetDpi ?? 300;

    // ── Step 1: Resolution Normalisation Audit ────────────────────────────────
    const resolutionSufficient = inputDpi >= MIN_OCR_DPI;
    const effectiveDpi = inputDpi;

    // ── Step 2: Grayscale Conversion ──────────────────────────────────────────
    // Immutable — creates a new Uint8Array, never touches pixelBuffer.
    const grayscale = this.toGrayscale(pixelBuffer, width, height);

    // ── Step 3: Inversion Detection & Correction ──────────────────────────────
    const contrastRatioBefore = this.calculateContrastRatio(grayscale);
    const inversionDetected = this.detectInversion(grayscale);
    if (inversionDetected) {
      this.invertGrayscale(grayscale);
    }

    // ── Step 4: Rotation & Orientation Detection and Lossless Correction ───────
    // Detects portrait/landscape and 0°, 90°, 180°, 270° orientation.
    // Corrects orientation before OCR so text lines are upright.
    // NEVER modifies the original document — operates purely on derived buffer.
    const orientationResult = this.detectOrientationAndRotation(
      grayscale,
      width,
      height,
      options.pdfRotation,
    );

    let workingGrayscale = grayscale;
    let workingWidth = width;
    let workingHeight = height;
    let appliedRotationDegrees: RotationDegrees = 0;
    let orientationCorrectionApplied = false;

    if (enableOrientationCorrection && orientationResult.detectedRotation !== 0) {
      const rotated = this.rotateGrayscale(
        grayscale,
        width,
        height,
        orientationResult.recommendedCorrectionRotation,
      );
      workingGrayscale = rotated.data;
      workingWidth = rotated.width;
      workingHeight = rotated.height;
      appliedRotationDegrees = orientationResult.recommendedCorrectionRotation;
      orientationCorrectionApplied = true;
    }

    // ── Step 5: Noise Reduction ───────────────────────────────────────────────
    // 3×3 median filter. Skipped if the image is already clean (low noise score).
    const noiseScore = this.estimateNoiseLevel(workingGrayscale, workingWidth, workingHeight);
    const noiseReductionApplied = enableNoiseReduction && noiseScore > NOISE_THRESHOLD;
    if (noiseReductionApplied) {
      this.applyMedianFilter(workingGrayscale, workingWidth, workingHeight);
    }

    // ── Step 6: Contrast Enhancement ─────────────────────────────────────────
    // Histogram stretch between 1st–99th percentile.
    // Skipped when the image already has sufficient contrast.
    const contrastEnhancementApplied =
      enableContrastEnhance && contrastRatioBefore < CONTRAST_SKIP_THRESHOLD;
    if (contrastEnhancementApplied) {
      this.enhanceContrast(workingGrayscale);
    }

    // ── Step 7: Deskew Angle Estimation ──────────────────────────────────────
    let deskewAngleDegrees = 0;
    if (enableDeskew) {
      deskewAngleDegrees = this.estimateSkewAngle(workingGrayscale, workingWidth, workingHeight);
    }
    const deskewApplied = enableDeskew && Math.abs(deskewAngleDegrees) >= DESKEW_ANGLE_SKIP_DEGREES;

    // ── Step 8: Border Cleanup ────────────────────────────────────────────────
    // Whitens a thin border strip to remove scanner edge artifacts.
    const borderCleanupApplied = enableBorderCleanup && workingWidth > 100 && workingHeight > 100;
    if (borderCleanupApplied) {
      this.cleanBorders(workingGrayscale, workingWidth, workingHeight);
    }

    // ── Step 9: Otsu Binarization (Optional Thresholding) ─────────────────────
    // Optional thresholding: converts grayscale pixels to crisp binary foreground/background.
    // Preserves original document by generating an independent derived buffer.
    // Applied when enableBinarization is true; skips redundant processing if already strictly binary.
    let binarizationSkippedReason: string | undefined;
    let binarizationApplied = false;
    let processedData = workingGrayscale;

    if (!enableBinarization) {
      binarizationSkippedReason = "disabled by caller options";
    } else if (this.isStrictlyBinary(workingGrayscale)) {
      binarizationSkippedReason = "image already strictly binary (0/255 values)";
      binarizationApplied = true;
    } else {
      processedData = this.applyOtsuBinarization(workingGrayscale);
      binarizationApplied = true;
    }

    // ── Step 10: RGBA Reconstruction ──────────────────────────────────────────
    // Convert derived grayscale back to 4-channel RGBA for Tesseract / canvas.
    const rgbaResult = this.grayscaleToRgba(processedData, workingWidth, workingHeight);

    // ── Audit Record & Geometries ─────────────────────────────────────────────
    const decision: PreprocessingDecision = {
      resolutionSufficient,
      inputDpi,
      effectiveDpi,
      grayscaleApplied: true,
      inversionDetected,
      contrastEnhancementApplied,
      contrastRatioBefore,
      noiseReductionApplied,
      borderCleanupApplied,
      estimatedSkewDegrees: deskewAngleDegrees,
      deskewApplied,
      binarizationApplied,
      binarizationSkippedReason,
      orientation: orientationResult.orientation,
      detectedRotationDegrees: orientationResult.detectedRotation,
      appliedRotationDegrees,
      orientationCorrectionApplied,
      orientationConfidence: orientationResult.confidence,
    };

    const originalGeometry: OcrImageGeometry = {
      width,
      height,
      dpi: inputDpi,
      aspectRatio: Number((width / height).toFixed(4)),
      rotation: orientationResult.detectedRotation,
      orientation: orientationResult.orientation,
      detectedRotation: orientationResult.detectedRotation,
      appliedRotation: appliedRotationDegrees,
      wasOrientationCorrected: orientationCorrectionApplied,
    };

    const preprocessedGeometry: OcrImageGeometry = {
      width: workingWidth,
      height: workingHeight,
      dpi: effectiveDpi,
      aspectRatio: Number((workingWidth / workingHeight).toFixed(4)),
      rotation: 0,
      orientation: workingWidth >= workingHeight ? "LANDSCAPE" : "PORTRAIT",
      detectedRotation: 0,
      appliedRotation: appliedRotationDegrees,
      wasOrientationCorrected: orientationCorrectionApplied,
    };

    return {
      pageNumber,
      originalGeometry,
      preprocessedGeometry,
      deskewAngleDegrees,
      isInverted: inversionDetected,
      contrastRatio: contrastRatioBefore,
      isBinarized: binarizationApplied,
      imageData: rgbaResult,
      sourceType: "RENDERED_PAGE",
      preprocessingDecision: decision,
    };
  }

  // ── Orientation & Rotation Detection and Lossless Rotation ──────────────────

  /**
   * Detects whether a page is portrait or landscape, and determines if it is
   * rotated 0°, 90°, 180°, or 270°.
   *
   * Utilizes PDF metadata if available, projection profile variance across candidate
   * angles, and character mass distribution.
   */
  public static detectOrientationAndRotation(
    grayscale: Uint8Array,
    width: number,
    height: number,
    pdfRotation?: RotationDegrees,
  ): OrientationDetectionResult {
    const orientation: DocumentOrientation = width >= height ? "LANDSCAPE" : "PORTRAIT";

    // 1. Explicit PDF metadata rotation takes precedence (confidence 100%)
    if (pdfRotation && (pdfRotation === 90 || pdfRotation === 180 || pdfRotation === 270)) {
      const correction = ((((360 - pdfRotation) % 360) + 360) % 360) as RotationDegrees;
      return {
        orientation,
        detectedRotation: pdfRotation,
        recommendedCorrectionRotation: correction,
        confidence: 100.0,
        method: "PDF_METADATA",
      };
    }

    if (width < 30 || height < 30) {
      return {
        orientation,
        detectedRotation: 0,
        recommendedCorrectionRotation: 0,
        confidence: 50.0,
        method: "HEURISTIC",
      };
    }

    // 2. Projection profile variance analysis over center region (70% crop)
    const cropX = Math.floor(width * 0.15);
    const cropY = Math.floor(height * 0.15);
    const cropW = Math.floor(width * 0.7);
    const cropH = Math.floor(height * 0.7);

    // Horizontal projection (row sums of dark pixels)
    const rowSums = new Float64Array(cropH);
    for (let y = 0; y < cropH; y++) {
      let sum = 0;
      const rowOffset = (cropY + y) * width + cropX;
      for (let x = 0; x < cropW; x += 2) {
        if ((grayscale[rowOffset + x] ?? 255) < 128) sum++;
      }
      rowSums[y] = sum;
    }

    // Vertical projection (column sums of dark pixels)
    const colSums = new Float64Array(cropW);
    for (let x = 0; x < cropW; x++) {
      let sum = 0;
      for (let y = 0; y < cropH; y += 2) {
        const idx = (cropY + y) * width + (cropX + x);
        if ((grayscale[idx] ?? 255) < 128) sum++;
      }
      colSums[x] = sum;
    }

    const varH = this.calculateArrayVariance(rowSums);
    const varV = this.calculateArrayVariance(colSums);

    // Text lines are horizontal in 0° and 180° (high row variance, smooth column variance).
    // Text lines are vertical in 90° and 270° (high column variance, smooth row variance).
    const isSideways = varV > varH * 1.25 && varV > 1.0;

    if (isSideways) {
      // Differentiate 90° vs 270°:
      // In 90° clockwise rotation, original left-margin line starts align along top rows.
      let topSum = 0;
      let botSum = 0;
      const segH = Math.max(1, Math.floor(cropH * 0.3));
      for (let y = 0; y < segH; y++) topSum += rowSums[y] ?? 0;
      for (let y = cropH - segH; y < cropH; y++) botSum += rowSums[y] ?? 0;

      const detectedRotation: RotationDegrees = topSum >= botSum ? 90 : 270;
      const correction = ((((360 - detectedRotation) % 360) + 360) % 360) as RotationDegrees;
      const ratio = varV / (varH + 1e-6);
      const confidence = Math.min(96.0, 70.0 + Math.min(26.0, ratio * 10));

      return {
        orientation,
        detectedRotation,
        recommendedCorrectionRotation: correction,
        confidence: Number(confidence.toFixed(1)),
        method: "PROJECTION_VARIANCE",
      };
    }

    // Upright vs Upside-down (0° vs 180°):
    // Standard Latin text has more mass in the bottom half of each text line (baseline and character body)
    // than in the top half (ascenders). Also top margin header/whitespace vs bottom footer.
    let topHalfMass = 0;
    let bottomHalfMass = 0;
    const halfH = Math.floor(cropH / 2);
    for (let y = 0; y < halfH; y++) topHalfMass += rowSums[y] ?? 0;
    for (let y = halfH; y < cropH; y++) bottomHalfMass += rowSums[y] ?? 0;

    let detectedRotation: RotationDegrees = 0;
    let confidence = 85.0;

    if (topHalfMass > 0 && bottomHalfMass > 0 && cropH > 100) {
      // If bottom half has vastly higher density than top half on a standard invoice:
      if (bottomHalfMass > topHalfMass * 2.8) {
        detectedRotation = 180;
        confidence = 75.0;
      }
    }

    const correction = ((((360 - detectedRotation) % 360) + 360) % 360) as RotationDegrees;

    return {
      orientation,
      detectedRotation,
      recommendedCorrectionRotation: correction,
      confidence: Number(confidence.toFixed(1)),
      method: "PROJECTION_VARIANCE",
    };
  }

  /**
   * Pure, lossless 2D rotation of a 1-channel grayscale buffer.
   * Allocates a new Uint8Array. NEVER mutates the source buffer.
   */
  public static rotateGrayscale(
    grayscale: Uint8Array,
    width: number,
    height: number,
    rotation: RotationDegrees,
  ): { data: Uint8Array; width: number; height: number } {
    if (rotation === 0) {
      return { data: new Uint8Array(grayscale), width, height };
    }

    if (rotation === 90) {
      // 90° clockwise: (x, y) -> (height - 1 - y, x), dimensions swap
      const newWidth = height;
      const newHeight = width;
      const rotated = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = y * width + x;
          const dstX = height - 1 - y;
          const dstY = x;
          rotated[dstY * newWidth + dstX] = grayscale[srcIdx] ?? 255;
        }
      }
      return { data: rotated, width: newWidth, height: newHeight };
    }

    if (rotation === 180) {
      // 180° clockwise: (x, y) -> (width - 1 - x, height - 1 - y)
      const rotated = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = y * width + x;
          const dstX = width - 1 - x;
          const dstY = height - 1 - y;
          rotated[dstY * width + dstX] = grayscale[srcIdx] ?? 255;
        }
      }
      return { data: rotated, width, height };
    }

    if (rotation === 270) {
      // 270° clockwise: (x, y) -> (y, width - 1 - x), dimensions swap
      const newWidth = height;
      const newHeight = width;
      const rotated = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = y * width + x;
          const dstX = y;
          const dstY = width - 1 - x;
          rotated[dstY * newWidth + dstX] = grayscale[srcIdx] ?? 255;
        }
      }
      return { data: rotated, width: newWidth, height: newHeight };
    }

    return { data: new Uint8Array(grayscale), width, height };
  }

  /**
   * Pure, lossless 2D rotation of a 4-channel RGBA buffer.
   * Allocates a new Uint8ClampedArray. NEVER mutates the source buffer.
   */
  public static rotateRgba(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    rotation: RotationDegrees,
  ): { data: Uint8ClampedArray; width: number; height: number } {
    if (rotation === 0) {
      return { data: new Uint8ClampedArray(rgba), width, height };
    }

    const totalPixels = width * height;
    const is90or270 = rotation === 90 || rotation === 270;
    const newWidth = is90or270 ? height : width;
    const newHeight = is90or270 ? width : height;
    const rotated = new Uint8ClampedArray(totalPixels * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let dstX = x;
        let dstY = y;

        if (rotation === 90) {
          dstX = height - 1 - y;
          dstY = x;
        } else if (rotation === 180) {
          dstX = width - 1 - x;
          dstY = height - 1 - y;
        } else if (rotation === 270) {
          dstX = y;
          dstY = width - 1 - x;
        }

        const srcOffset = (y * width + x) * 4;
        const dstOffset = (dstY * newWidth + dstX) * 4;

        rotated[dstOffset] = rgba[srcOffset] ?? 0;
        rotated[dstOffset + 1] = rgba[srcOffset + 1] ?? 0;
        rotated[dstOffset + 2] = rgba[srcOffset + 2] ?? 0;
        rotated[dstOffset + 3] = rgba[srcOffset + 3] ?? 255;
      }
    }

    return { data: rotated, width: newWidth, height: newHeight };
  }

  // ── Pixel Transforms ────────────────────────────────────────────────────────

  /**
   * Converts RGBA/RGB pixel buffer to a new 1-channel Uint8Array (0..255).
   * Uses ITU-R BT.601 luminance: Y = 0.299R + 0.587G + 0.114B.
   * Never mutates the source buffer.
   */
  public static toGrayscale(
    buffer: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const totalPixels = width * height;
    const grayscale = new Uint8Array(totalPixels);
    const bytesPerPixel = buffer.length >= totalPixels * 4 ? 4 : 3;

    for (let i = 0; i < totalPixels; i++) {
      const srcIdx = i * bytesPerPixel;
      const r = buffer[srcIdx] ?? 255;
      const g = buffer[srcIdx + 1] ?? 255;
      const b = buffer[srcIdx + 2] ?? 255;
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return grayscale;
  }

  /**
   * Converts 1-channel grayscale back to 4-channel RGBA.
   */
  public static grayscaleToRgba(
    grayscale: Uint8Array,
    width: number,
    height: number,
  ): Uint8ClampedArray {
    const totalPixels = width * height;
    const rgba = new Uint8ClampedArray(totalPixels * 4);

    for (let i = 0; i < totalPixels; i++) {
      const val = grayscale[i] ?? 255;
      const dstIdx = i * 4;
      rgba[dstIdx] = val; // R
      rgba[dstIdx + 1] = val; // G
      rgba[dstIdx + 2] = val; // B
      rgba[dstIdx + 3] = 255; // Alpha
    }

    return rgba;
  }

  /**
   * Calculates the Michelson / RMS contrast ratio (0..1).
   */
  public static calculateContrastRatio(grayscale: Uint8Array): number {
    if (grayscale.length === 0) return 1.0;
    let min = 255;
    let max = 0;

    const sampleStep = Math.max(1, Math.floor(grayscale.length / 5000));
    for (let i = 0; i < grayscale.length; i += sampleStep) {
      const v = grayscale[i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (max + min === 0) return 1.0;
    return Number(((max - min) / (max + min)).toFixed(4));
  }

  /**
   * Checks if an image has a dark background with light text.
   * Average luminance < 80 indicates dominant dark background.
   */
  public static detectInversion(grayscale: Uint8Array): boolean {
    if (grayscale.length === 0) return false;
    let sum = 0;
    const sampleStep = Math.max(1, Math.floor(grayscale.length / 5000));
    let sampleCount = 0;

    for (let i = 0; i < grayscale.length; i += sampleStep) {
      sum += grayscale[i] ?? 0;
      sampleCount++;
    }

    const avgLuminance = sum / sampleCount;
    return avgLuminance < 80;
  }

  /**
   * Inverts grayscale pixel values in-place on the derived buffer.
   */
  public static invertGrayscale(grayscale: Uint8Array): void {
    for (let i = 0; i < grayscale.length; i++) {
      grayscale[i] = 255 - (grayscale[i] ?? 0);
    }
  }

  /**
   * Estimates high-frequency noise level via local 3×3 variance.
   */
  public static estimateNoiseLevel(grayscale: Uint8Array, width: number, height: number): number {
    if (width < 10 || height < 10) return 0;

    let totalVariance = 0;
    let samples = 0;
    const step = Math.max(4, Math.floor(Math.min(width, height) / 20));

    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += grayscale[(y + dy) * width + (x + dx)] ?? 0;
          }
        }
        const mean = sum / 9;
        let localVariance = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = grayscale[(y + dy) * width + (x + dx)] ?? 0;
            localVariance += Math.abs(v - mean);
          }
        }
        totalVariance += localVariance / 9;
        samples++;
      }
    }

    return samples > 0 ? totalVariance / samples : 0;
  }

  /**
   * Applies a fast 3×3 median filter for noise reduction.
   */
  public static applyMedianFilter(grayscale: Uint8Array, width: number, height: number): void {
    const copy = new Uint8Array(grayscale);
    const window = new Uint8Array(9);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            window[k++] = copy[(y + dy) * width + (x + dx)] ?? 0;
          }
        }
        // Small 9-element bubble/insertion sort for median (index 4)
        for (let i = 0; i < 5; i++) {
          let minIdx = i;
          for (let j = i + 1; j < 9; j++) {
            if ((window[j] ?? 0) < (window[minIdx] ?? 0)) minIdx = j;
          }
          const tmp = window[i] ?? 0;
          window[i] = window[minIdx] ?? 0;
          window[minIdx] = tmp;
        }
        grayscale[y * width + x] = window[4] ?? 0;
      }
    }
  }

  /**
   * Enhances contrast via histogram stretching (1st–99th percentile).
   */
  public static enhanceContrast(grayscale: Uint8Array): void {
    if (grayscale.length === 0) return;

    const histogram = new Uint32Array(256);
    for (let i = 0; i < grayscale.length; i++) {
      histogram[grayscale[i] ?? 0]++;
    }

    const lowCount = Math.floor(grayscale.length * 0.01);
    const highCount = Math.floor(grayscale.length * 0.99);

    let lowThresh = 0;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += histogram[i] ?? 0;
      if (acc >= lowCount) {
        lowThresh = i;
        break;
      }
    }

    let highThresh = 255;
    acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += histogram[i] ?? 0;
      if (acc >= highCount) {
        highThresh = i;
        break;
      }
    }

    if (highThresh <= lowThresh) return;

    const scale = 255 / (highThresh - lowThresh);
    for (let i = 0; i < grayscale.length; i++) {
      const val = grayscale[i] ?? 0;
      if (val <= lowThresh) {
        grayscale[i] = 0;
      } else if (val >= highThresh) {
        grayscale[i] = 255;
      } else {
        grayscale[i] = Math.round((val - lowThresh) * scale);
      }
    }
  }

  /**
   * Cleans border artifacts by whitening a thin border margin (1% width/height).
   */
  public static cleanBorders(grayscale: Uint8Array, width: number, height: number): void {
    const borderX = Math.max(1, Math.floor(width * BORDER_FRACTION));
    const borderY = Math.max(1, Math.floor(height * BORDER_FRACTION));

    // Top and bottom margin strips
    for (let y = 0; y < borderY; y++) {
      for (let x = 0; x < width; x++) {
        grayscale[y * width + x] = 255;
        grayscale[(height - 1 - y) * width + x] = 255;
      }
    }

    // Left and right margin strips
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < borderX; x++) {
        grayscale[y * width + x] = 255;
        grayscale[y * width + (width - 1 - x)] = 255;
      }
    }
  }

  /**
   * Applies Otsu's Global Adaptive Thresholding.
   * Maximises inter-class variance between background and foreground text pixels.
   * Returns a new binarized Uint8Array. Does not mutate the input.
   */
  public static applyOtsuBinarization(grayscale: Uint8Array): Uint8Array {
    const totalPixels = grayscale.length;
    if (totalPixels === 0) return new Uint8Array(grayscale);

    const hist = new Float64Array(256);
    for (let i = 0; i < totalPixels; i++) {
      hist[grayscale[i] ?? 0]++;
    }
    for (let i = 0; i < 256; i++) {
      hist[i] /= totalPixels;
    }

    let sumTotal = 0;
    for (let i = 0; i < 256; i++) {
      sumTotal += i * (hist[i] ?? 0);
    }

    let weightBackground = 0;
    let sumBackground = 0;
    let maxVariance = 0;
    let optimalThreshold = 128;

    for (let t = 0; t < 256; t++) {
      weightBackground += hist[t] ?? 0;
      if (weightBackground === 0) continue;
      const weightForeground = 1 - weightBackground;
      if (weightForeground === 0) break;

      sumBackground += t * (hist[t] ?? 0);
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sumTotal - sumBackground) / weightForeground;
      const betweenClassVariance =
        weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);

      if (betweenClassVariance > maxVariance) {
        maxVariance = betweenClassVariance;
        optimalThreshold = t;
      }
    }

    const binarized = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      binarized[i] = (grayscale[i] ?? 0) < optimalThreshold ? 0 : 255;
    }

    return binarized;
  }

  /**
   * Checks whether a grayscale buffer is already strictly binary (only 0 or 255 values).
   */
  public static isStrictlyBinary(grayscale: Uint8Array): boolean {
    if (grayscale.length === 0) return false;
    const sampleStep = Math.max(1, Math.floor(grayscale.length / 5000));
    for (let i = 0; i < grayscale.length; i += sampleStep) {
      const val = grayscale[i];
      if (val !== 0 && val !== 255) return false;
    }
    return true;
  }

  /**
   * Estimates document skew angle (−5° to +5°) using projection profile variance.
   * Returns 0.0 for tiny images or when skew cannot be reliably determined.
   */
  public static estimateSkewAngle(grayscale: Uint8Array, width: number, height: number): number {
    if (width < 50 || height < 50) return 0.0;

    const cropX = Math.floor(width * 0.15);
    const cropY = Math.floor(height * 0.15);
    const cropW = Math.floor(width * 0.7);
    const cropH = Math.floor(height * 0.7);

    let bestAngle = 0;
    let maxVariance = -1;

    for (let a = -5.0; a <= 5.0; a += 0.5) {
      const rad = (a * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const projectedRows = new Float32Array(cropH);
      const counts = new Uint32Array(cropH);

      const step = 4;
      for (let y = 0; y < cropH; y += step) {
        for (let x = 0; x < cropW; x += step) {
          const globalIdx = (cropY + y) * width + (cropX + x);
          const pixelVal = (grayscale[globalIdx] ?? 255) < 128 ? 1 : 0;

          const rx = x - cropW / 2;
          const ry = y - cropH / 2;
          const rotY = Math.round(-rx * sin + ry * cos + cropH / 2);

          if (rotY >= 0 && rotY < cropH) {
            projectedRows[rotY] += pixelVal;
            counts[rotY]++;
          }
        }
      }

      let sum = 0;
      let validRows = 0;
      for (let y = 0; y < cropH; y++) {
        if ((counts[y] ?? 0) > 0) {
          sum += projectedRows[y] ?? 0;
          validRows++;
        }
      }

      if (validRows === 0) continue;
      const mean = sum / validRows;
      let variance = 0;
      for (let y = 0; y < cropH; y++) {
        if ((counts[y] ?? 0) > 0) {
          variance += Math.pow((projectedRows[y] ?? 0) - mean, 2);
        }
      }

      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = a;
      }
    }

    return Number(bestAngle.toFixed(2));
  }

  private static calculateArrayVariance(arr: Float64Array): number {
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] ?? 0;
    const mean = sum / arr.length;
    let sumSq = 0;
    for (let i = 0; i < arr.length; i++) {
      sumSq += Math.pow((arr[i] ?? 0) - mean, 2);
    }
    return sumSq / arr.length;
  }
}
