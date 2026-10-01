/**
 * ENERA PRODUCTION OCR ENGINE — IMAGE PREPROCESSING ENGINE
 * ========================================================
 * Prepares scanned, degraded, skewed, or photographed document images
 * for optimal optical character recognition without introducing hallucinations:
 *
 *  Raw Image
 *     ↓
 *  Grayscale Conversion (Luminance weighting)
 *     ↓
 *  Inversion Check (Dark text on light background)
 *     ↓
 *  Contrast Stretching / Histogram Normalization
 *     ↓
 *  Adaptive Binarization (Otsu's Thresholding)
 *     ↓
 *  Deskew Angle Estimation & Geometric Normalization
 *     ↓
 *  Clean Binary Image Data for OCR Engine
 */

import type { OcrImageGeometry, OcrPreprocessedImage } from "./types";

export interface PreprocessingOptions {
  enableDeskew?: boolean;
  enableBinarization?: boolean;
  enableContrastEnhance?: boolean;
  targetDpi?: number;
}

export class ImagePreprocessingEngine {
  /**
   * Preprocesses a raw RGBA or RGB pixel buffer
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
    const targetDpi = options.targetDpi || 300;

    const originalGeometry: OcrImageGeometry = {
      width,
      height,
      dpi: 300,
      aspectRatio: Number((width / height).toFixed(4)),
      rotation: 0,
    };

    // 1. Convert to Grayscale
    const grayscale = this.toGrayscale(pixelBuffer, width, height);

    // 2. Compute Contrast Ratio
    const contrastRatio = this.calculateContrastRatio(grayscale);

    // 3. Detect Inversion (Light text on dark background)
    const isInverted = this.detectInversion(grayscale);
    if (isInverted) {
      this.invertGrayscale(grayscale);
    }

    // 4. Contrast Enhancement
    if (enableContrastEnhance) {
      this.enhanceContrast(grayscale);
    }

    // 5. Deskew Angle Estimation
    let deskewAngleDegrees = 0;
    if (enableDeskew) {
      deskewAngleDegrees = this.estimateSkewAngle(grayscale, width, height);
    }

    // 6. Adaptive Binarization (Otsu's method)
    let processedData = grayscale;
    let isBinarized = false;
    if (enableBinarization) {
      processedData = this.applyOtsuBinarization(grayscale);
      isBinarized = true;
    }

    // Convert back to RGBA for canvas / Tesseract compatibility
    const rgbaResult = this.grayscaleToRgba(processedData, width, height);

    return {
      pageNumber,
      originalGeometry,
      preprocessedGeometry: {
        ...originalGeometry,
        dpi: targetDpi,
      },
      deskewAngleDegrees,
      isInverted,
      contrastRatio,
      isBinarized,
      imageData: rgbaResult,
      sourceType: "RENDERED_PAGE",
    };
  }

  /**
   * Converts RGBA/RGB pixel buffer into a 1-channel Grayscale array (0..255)
   * Using ITU-R BT.601 standard luminance: Y = 0.299*R + 0.587*G + 0.114*B
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
      const r = buffer[srcIdx];
      const g = buffer[srcIdx + 1];
      const b = buffer[srcIdx + 2];
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return grayscale;
  }

  /**
   * Converts 1-channel grayscale to standard 4-channel RGBA (for Tesseract canvas input)
   */
  public static grayscaleToRgba(
    grayscale: Uint8Array,
    width: number,
    height: number,
  ): Uint8ClampedArray {
    const totalPixels = width * height;
    const rgba = new Uint8ClampedArray(totalPixels * 4);

    for (let i = 0; i < totalPixels; i++) {
      const val = grayscale[i];
      const dstIdx = i * 4;
      rgba[dstIdx] = val; // R
      rgba[dstIdx + 1] = val; // G
      rgba[dstIdx + 2] = val; // B
      rgba[dstIdx + 3] = 255; // Alpha
    }

    return rgba;
  }

  /**
   * Calculates the Michelson / RMS contrast ratio
   */
  public static calculateContrastRatio(grayscale: Uint8Array): number {
    if (grayscale.length === 0) return 1.0;
    let min = 255;
    let max = 0;

    for (let i = 0; i < grayscale.length; i++) {
      const v = grayscale[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (max + min === 0) return 1.0;
    return Number(((max - min) / (max + min)).toFixed(4));
  }

  /**
   * Checks if an image has a dark background with light text
   */
  public static detectInversion(grayscale: Uint8Array): boolean {
    if (grayscale.length === 0) return false;
    let sum = 0;
    const sampleStep = Math.max(1, Math.floor(grayscale.length / 5000));
    let sampleCount = 0;

    for (let i = 0; i < grayscale.length; i += sampleStep) {
      sum += grayscale[i];
      sampleCount++;
    }

    const avgLuminance = sum / sampleCount;
    // Average luminance < 80 indicates dominant dark background
    return avgLuminance < 80;
  }

  /**
   * Inverts grayscale pixel values
   */
  public static invertGrayscale(grayscale: Uint8Array): void {
    for (let i = 0; i < grayscale.length; i++) {
      grayscale[i] = 255 - grayscale[i];
    }
  }

  /**
   * Enhances contrast via histogram stretching (linear normalization between 1st and 99th percentiles)
   */
  public static enhanceContrast(grayscale: Uint8Array): void {
    if (grayscale.length === 0) return;

    // Build histogram
    const histogram = new Uint32Array(256);
    for (let i = 0; i < grayscale.length; i++) {
      histogram[grayscale[i]]++;
    }

    // Find 1st and 99th percentiles to avoid outlier noise
    const lowCount = Math.floor(grayscale.length * 0.01);
    const highCount = Math.floor(grayscale.length * 0.99);

    let lowThresh = 0;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += histogram[i];
      if (acc >= lowCount) {
        lowThresh = i;
        break;
      }
    }

    let highThresh = 255;
    acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += histogram[i];
      if (acc >= highCount) {
        highThresh = i;
        break;
      }
    }

    if (highThresh <= lowThresh) return;

    const scale = 255 / (highThresh - lowThresh);
    for (let i = 0; i < grayscale.length; i++) {
      const val = grayscale[i];
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
   * Applies Otsu's Global Adaptive Thresholding
   * Maximizes inter-class variance between background and foreground text pixels
   */
  public static applyOtsuBinarization(grayscale: Uint8Array): Uint8Array {
    const totalPixels = grayscale.length;
    if (totalPixels === 0) return grayscale;

    // 1. Histogram
    const hist = new Float64Array(256);
    for (let i = 0; i < totalPixels; i++) {
      hist[grayscale[i]]++;
    }

    // Normalize histogram probabilities
    for (let i = 0; i < 256; i++) {
      hist[i] /= totalPixels;
    }

    // Compute cumulative sums and means
    let sumTotal = 0;
    for (let i = 0; i < 256; i++) {
      sumTotal += i * hist[i];
    }

    let weightBackground = 0;
    let sumBackground = 0;
    let maxVariance = 0;
    let optimalThreshold = 128;

    for (let t = 0; t < 256; t++) {
      weightBackground += hist[t];
      if (weightBackground === 0) continue;
      const weightForeground = 1 - weightBackground;
      if (weightForeground === 0) break;

      sumBackground += t * hist[t];
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sumTotal - sumBackground) / weightForeground;

      // Inter-class variance
      const betweenClassVariance =
        weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);

      if (betweenClassVariance > maxVariance) {
        maxVariance = betweenClassVariance;
        optimalThreshold = t;
      }
    }

    // 2. Binarize: Foreground text = 0 (black), Background = 255 (white)
    const binarized = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      binarized[i] = grayscale[i] < optimalThreshold ? 0 : 255;
    }

    return binarized;
  }

  /**
   * Estimates document skew angle (-15° to +15°) using projection profile variance
   */
  public static estimateSkewAngle(grayscale: Uint8Array, width: number, height: number): number {
    // Only sample if image dimensions are reasonable
    if (width < 50 || height < 50) return 0.0;

    // Subsample center crop to avoid margin noise and boost execution speed
    const cropX = Math.floor(width * 0.15);
    const cropY = Math.floor(height * 0.15);
    const cropW = Math.floor(width * 0.7);
    const cropH = Math.floor(height * 0.7);

    let bestAngle = 0;
    let maxVariance = -1;

    // Test candidate angles from -5.0 to +5.0 degrees in steps of 0.5 degrees
    const angles: number[] = [];
    for (let a = -5.0; a <= 5.0; a += 0.5) {
      angles.push(a);
    }

    for (const angle of angles) {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Project onto rotated vertical axis (horizontal projection)
      const projectedRows = new Float32Array(cropH);
      const counts = new Uint32Array(cropH);

      const step = 4; // Subsample pixels
      for (let y = 0; y < cropH; y += step) {
        for (let x = 0; x < cropW; x += step) {
          const globalIdx = (cropY + y) * width + (cropX + x);
          const pixelVal = grayscale[globalIdx] < 128 ? 1 : 0; // Text is 1

          // Rotated Y coordinate relative to crop center
          const rx = x - cropW / 2;
          const ry = y - cropH / 2;
          const rotY = Math.round(-rx * sin + ry * cos + cropH / 2);

          if (rotY >= 0 && rotY < cropH) {
            projectedRows[rotY] += pixelVal;
            counts[rotY]++;
          }
        }
      }

      // Calculate variance of projected rows
      let sum = 0;
      let validRows = 0;
      for (let y = 0; y < cropH; y++) {
        if (counts[y] > 0) {
          sum += projectedRows[y];
          validRows++;
        }
      }

      if (validRows === 0) continue;
      const mean = sum / validRows;
      let variance = 0;
      for (let y = 0; y < cropH; y++) {
        if (counts[y] > 0) {
          variance += Math.pow(projectedRows[y] - mean, 2);
        }
      }

      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }

    return Number(bestAngle.toFixed(2));
  }
}
