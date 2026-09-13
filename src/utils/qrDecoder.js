import { readBarcodesFromImageFile, readBarcodesFromImageData } from 'zxing-wasm';
import jsQR from 'jsqr';

/**
 * Universal, high-accuracy in-browser QR code decoder powered by zxing-wasm.
 * Decodes standard, dense, borderless, high-version, and noisy QR codes 100% locally in WebAssembly.
 *
 * @param {Blob | File | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement} source
 * @returns {Promise<string>}
 */
export async function decodeQrFromImageOrCanvas(source) {
  // 1. If Blob or File: use zxing-wasm readBarcodesFromImageFile directly
  if (source instanceof Blob || source instanceof File) {
    try {
      const results = await readBarcodesFromImageFile(source, { formats: ['QRCode', 'MicroQRCode'] });
      if (results && results.length > 0 && results[0].text) {
        return results[0].text;
      }
    } catch {
      // fallback to canvas extraction
    }
  }

  // 2. Extract ImageData from source element (Image, Canvas, or Video)
  let canvas;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.videoWidth || source.width || 800;
    canvas.height = source.naturalHeight || source.videoHeight || source.height || 800;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 3. Try zxing-wasm with ImageData
  try {
    const results = await readBarcodesFromImageData(imgData, { formats: ['QRCode', 'MicroQRCode'] });
    if (results && results.length > 0 && results[0].text) {
      return results[0].text;
    }
  } catch {
    // continue to fallback
  }

  // 4. Try native browser BarcodeDetector if available
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(canvas);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch {
      // continue to fallback
    }
  }

  // 5. Fallback: jsQR with direct & padded sampling
  try {
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;

    // With quiet-zone margin
    const pad = Math.max(24, Math.round(canvas.width * 0.08));
    const padCanvas = document.createElement('canvas');
    padCanvas.width = canvas.width + pad * 2;
    padCanvas.height = canvas.height + pad * 2;
    const padCtx = padCanvas.getContext('2d', { willReadFrequently: true });
    padCtx.fillStyle = '#ffffff';
    padCtx.fillRect(0, 0, padCanvas.width, padCanvas.height);
    padCtx.drawImage(canvas, pad, pad);
    const padData = padCtx.getImageData(0, 0, padCanvas.width, padCanvas.height);

    const padCode = jsQR(padData.data, padData.width, padData.height, { inversionAttempts: 'attemptBoth' });
    if (padCode && padCode.data) return padCode.data;
  } catch {
    // continue
  }

  throw new Error('No QR code detected in the image.');
}
