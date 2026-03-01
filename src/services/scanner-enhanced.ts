// ===== Barcode Scanner — Enhanced Multi-Engine Detection =====
// Camera-only, flexible barcode validation, ZXing + QuaggaJS support
// Enhanced image processing for maximum detection success

import { BrowserMultiFormatOneDReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

export const SCANNER_VERSION = '1.3.0';
// v1.0.0 – Initial ZXing + QuaggaJS multi-engine scanner
// v1.1.0 – Fix regex bug in barcode candidate cleaning
// v1.2.0 – Pre-load QuaggaJS before strategy list; add direct decodeFromImageElement strategy
// v1.3.0 – Create fresh ZXing reader per decode attempt to prevent caching

console.log(`[Scanner] v${SCANNER_VERSION} loaded`);

// Dynamically import QuaggaJS for better compatibility
let Quagga: any = null;

// Async function to load QuaggaJS dynamically
async function loadQuagga() {
  if (Quagga) return Quagga;
  
  try {
    // Try dynamic import first (modern bundlers)
    const QuaggaModule = await import('quagga');
    Quagga = QuaggaModule.default || QuaggaModule;
    console.log('✅ QuaggaJS loaded via dynamic import');
    return Quagga;
  } catch (err) {
    console.warn('QuaggaJS dynamic import failed:', err);
    
    // Fallback to global window object (if loaded via script tag)
    if (typeof window !== 'undefined' && (window as any).Quagga) {
      Quagga = (window as any).Quagga;
      console.log('✅ QuaggaJS loaded from window object');
      return Quagga;
    }
    
    console.warn('QuaggaJS not available in any form');
    return null;
  }
}

// ── Supported barcode prefixes for battery products ──
export const BARCODE_PREFIXES: Record<string, string> = {
  '12N5L': 'Bình ắc quy Natri – Ion xe máy số 12N5L',
  '12N7L': 'Bình ắc quy Natri Ion xe máy ga 12N7L',
  'YTX4A': 'Bình ắc quy xe máy Natri Ion YTX4A',
  'YTX5A': 'Bình ắc quy xe tay ga Natri Ion YTX5A',
  'YTX7A': 'Bình ắc quy xe tay ga Natri Ion YTX7A',
};

export const VALID_PREFIXES = Object.keys(BARCODE_PREFIXES);

// ── Enhanced flexible barcode validation ──
export function isValidBarcode(barcode: string): boolean {
  if (!barcode) return false;
  const trimmed = barcode.trim().toUpperCase();
  
  console.log('🔍 Barcode validation:', {
    original: barcode,
    trimmed: trimmed,
    length: trimmed.length
  });
  
  // ✅ PRIMARY: Accept any barcode starting with 5 valid battery product codes
  const hasValidPrefix = VALID_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (hasValidPrefix) {
    // Must be at least 8 chars total (prefix length + at least 3 more)
    if (trimmed.length >= 8) {
      console.log('✅ Valid battery barcode with known prefix:', trimmed.substring(0, 5));
      return true;
    }
  }
  
  // 📊 FALLBACK: Accept numeric barcodes (8-20 digits)
  const isNumeric = /^\d{8,20}$/.test(trimmed);
  if (isNumeric) {
    console.log('📊 Valid numeric barcode:', trimmed);
    return true;
  }
  
  // ❌ Otherwise invalid
  console.log('❌ Barcode validation failed:', trimmed);
  return false;
}

// ── Parse prefix from barcode → return SKU + product name ────────
export function parseBarcodePrefix(
  barcode: string,
): { sku: string; productName: string } | null {
  const trimmed = barcode.trim().toUpperCase();
  for (const prefix of VALID_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return { sku: prefix, productName: BARCODE_PREFIXES[prefix] };
    }
  }
  return null;
}

// ── Create Enhanced ZXing 1D Reader (fresh instance, no cache) ──────
function createReader(): BrowserMultiFormatOneDReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODABAR,
    BarcodeFormat.ITF,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatOneDReader(hints);
}

// ── Create Multi-Format Reader with TRY_HARDER (fresh, no cache) ──────
function createMultiReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

// ── Enhanced detection from image file ──────────────────────────
export async function decodeFromImageFile(file: File): Promise<{
  imageData: string;
  barcode?: string;
  debugInfo?: string;
}> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File phải là ảnh (JPG, PNG, etc.)'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target?.result as string;
        if (!imageData) {
          reject(new Error('Không thể đọc file ảnh'));
          return;
        }

        const img = new Image();
        img.onload = async () => {
          try {
            let barcode: string | undefined;
            let debugInfo = `Enhanced multi-engine processing ${file.name} (${img.width}x${img.height}px, ${Math.round(file.size/1024)}KB). `;

            // Pre-load QuaggaJS before building strategy list
            const quagga = await loadQuagga();

            // ── STRATEGY 0: ZXing direct from image element (fresh readers, no cache) ──
            try {
              console.log('🔬 Trying ZXing Multi direct from img element...');
              const r0 = createMultiReader();  // fresh instance every time
              const directResult = await r0.decodeFromImageElement(img);
              if (directResult) {
                const text = directResult.getText()?.trim()?.toUpperCase();
                if (text && isValidBarcode(text)) {
                  barcode = text;
                  debugInfo += `SUCCESS with ZXing Direct: "${barcode}". `;
                  console.log('✅ Direct detection:', barcode);
                }
              }
            } catch {
              console.log('Direct multi detection failed, trying 1D...');
            }

            // Also try 1D reader directly on img element (fresh instance)
            if (!barcode) {
              try {
                const r0b = createReader();  // fresh instance every time
                const directResult1D = await r0b.decodeFromImageElement(img);
                if (directResult1D) {
                  const text = directResult1D.getText()?.trim()?.toUpperCase();
                  if (text && isValidBarcode(text)) {
                    barcode = text;
                    debugInfo += `SUCCESS with ZXing1D Direct: "${barcode}". `;
                    console.log('✅ Direct 1D detection:', barcode);
                  }
                }
              } catch {
                // continue
              }
            }

            // Enhanced detection strategies (run if direct detection failed)
            const strategies: any[] = [
              { scale: 1.0, rotate: 0, enhance: 'none', engine: 'zxing', label: 'ZXing Original' },
              { scale: 1.0, rotate: 0, enhance: 'grayscale', engine: 'zxing', label: 'ZXing Grayscale' },
              { scale: 1.0, rotate: 0, enhance: 'contrast', engine: 'zxing', label: 'ZXing High Contrast' },
              { scale: 1.2, rotate: 0, enhance: 'contrast', engine: 'zxing', label: 'ZXing Large + Contrast' },
              { scale: 0.8, rotate: 0, enhance: 'contrast', engine: 'zxing', label: 'ZXing Small + Contrast' },
              { scale: 1.0, rotate: 0, enhance: 'sharpen', engine: 'zxing', label: 'ZXing Sharpened' },
              { scale: 1.0, rotate: 5, enhance: 'contrast', engine: 'zxing', label: 'ZXing Rotated +5°' },
              { scale: 1.0, rotate: -5, enhance: 'contrast', engine: 'zxing', label: 'ZXing Rotated -5°' },
              { scale: 1.0, rotate: 0, enhance: 'binary', engine: 'zxing', label: 'ZXing Binary' },
              { scale: 1.5, rotate: 0, enhance: 'none', engine: 'zxing', label: 'ZXing Large Scale' },
              { scale: 0.6, rotate: 0, enhance: 'extreme', engine: 'zxing', label: 'ZXing Small + Extreme' },
            ];

            // Add QuaggaJS strategies if available (already pre-loaded above)
            if (quagga) {
              strategies.push(
                { scale: 1.0, rotate: 0, enhance: 'none', engine: 'quagga', label: 'Quagga Original' },
                { scale: 1.0, rotate: 0, enhance: 'contrast', engine: 'quagga', label: 'Quagga High Contrast' },
                { scale: 1.2, rotate: 0, enhance: 'contrast', engine: 'quagga', label: 'Quagga Large + Contrast' },
                { scale: 0.8, rotate: 0, enhance: 'sharpen', engine: 'quagga', label: 'Quagga Small + Sharp' }
              );
            }

            // Try each strategy until success
            for (const strategy of strategies) {
              if (barcode) break;
              
              try {
                console.log(`🔄 Trying: ${strategy.label}`);
                const canvas = await processImageWithStrategy(img, strategy);
                if (!canvas) continue;

                let result: string | null = null;
                
                if (strategy.engine === 'quagga' && quagga) {
                  result = await detectWithQuagga(canvas);
                } else {
                  // Create fresh readers each strategy attempt — prevents ZXing internal cache
                  const freshReaders = [createMultiReader(), createReader()];
                  for (const reader of freshReaders) {
                    try {
                      const zxingResult = await reader.decodeFromCanvas(canvas);
                      if (zxingResult) {
                        result = zxingResult.getText()?.trim();
                        break;
                      }
                    } catch {
                      // Continue to next reader
                    }
                  }
                }
                
                if (result) {
                  console.log(`🎯 Raw detection: "${result}"`);
                  
                  // Try multiple cleaning methods
                  const candidates = [
                    result,
                    result.toUpperCase(),
                    result.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
                    result.trim().toUpperCase(),
                    result.replace(/[\s\-_\.]/g, '').toUpperCase()  // FIX: single backslash for regex
                  ];
                  
                  for (const candidate of candidates) {
                    if (candidate && isValidBarcode(candidate)) {
                      barcode = candidate;
                      debugInfo += `SUCCESS with ${strategy.label}: "${barcode}". `;
                      console.log('✅ Valid barcode detected:', barcode);
                      break;
                    }
                  }
                  
                  if (barcode) break;
                } else {
                  console.log(`❌ No detection with ${strategy.label}`);
                }
                
              } catch (err) {
                console.log(`⚠️ Strategy ${strategy.label} failed:`, err);
              }
            }

            if (!barcode) {
              debugInfo += 'No valid barcode detected with any strategy.';
              console.log('❌ Detection failed after all strategies');
            }

            resolve({ imageData, barcode, debugInfo });
          } catch (error) {
            console.error('Enhanced detection error:', error);
            reject(new Error('Lỗi khi xử lý ảnh: ' + (error as Error).message));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Không thể tải ảnh. Vui lòng chọn file ảnh hợp lệ.'));
        };
        img.src = imageData;
      } catch (error) {
        reject(new Error('Lỗi khi đọc file: ' + (error as Error).message));
      }
    };
    reader.onerror = () => {
      reject(new Error('Không thể đọc file ảnh'));
    };
    reader.readAsDataURL(file);
  });
}

// ── Process image with specific strategy ──
async function processImageWithStrategy(img: HTMLImageElement, strategy: any): Promise<HTMLCanvasElement | null> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaledWidth = Math.floor(img.width * strategy.scale);
    const scaledHeight = Math.floor(img.height * strategy.scale);
    
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    
    // Apply rotation if needed
    if (strategy.rotate && strategy.rotate !== 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((strategy.rotate * Math.PI) / 180);
      ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
    }
    
    // Apply enhancement
    if (strategy.enhance && strategy.enhance !== 'none') {
      enhanceImage(ctx, canvas, strategy.enhance);
    }
    
    return canvas;
  } catch (error) {
    console.error('Error processing strategy:', error);
    return null;
  }
}

// ── Image enhancement functions ──
function enhanceImage(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, enhanceType: string) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  switch (enhanceType) {
    case 'grayscale':
      // Pure grayscale (no thresholding) - helps ZXing's internal processing
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      break;
    
    case 'contrast':
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const enhanced = gray > 140 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = enhanced;
      }
      break;
      
    case 'binary':
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const binary = gray > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = binary;
      }
      break;
      
    case 'sharpen':
      const sharpened = new Uint8ClampedArray(data);
      const width = canvas.width;
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor(i / 4 / width);
        
        if (x > 0 && x < width - 1 && y > 0 && y < canvas.height - 1) {
          const center = data[i];
          const top = data[i - width * 4];
          const bottom = data[i + width * 4];
          const left = data[i - 4];
          const right = data[i + 4];
          
          const enhanced = Math.max(0, Math.min(255, center * 5 - top - bottom - left - right));
          sharpened[i] = sharpened[i + 1] = sharpened[i + 2] = enhanced;
        }
      }
      data.set(sharpened);
      break;
      
    case 'extreme':
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const enhanced = gray > 120 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = enhanced;
      }
      break;
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// ── QuaggaJS detection (if available) ──
async function detectWithQuagga(canvas: HTMLCanvasElement): Promise<string | null> {
  const quagga = await loadQuagga();
  if (!quagga) return null;
  
  return new Promise((resolve) => {
    try {
      quagga.decodeSingle({
        src: canvas.toDataURL(),
        numOfWorkers: 0,
        decoder: {
          readers: [
            'code_128_reader',
            'code_39_reader', 
            'code_93_reader',
            'ean_reader',
            'ean_8_reader',
            'code_39_vin_reader',
            'codabar_reader',
            'i2of5_reader'
          ]
        },
        locate: true
      }, (result: any) => {
        if (result && result.codeResult) {
          resolve(result.codeResult.code?.trim());
        } else {
          resolve(null);
        }
      });
    } catch (err) {
      resolve(null);
    }
  });
}

// ── Phone number validation ──────────────────────────────────────
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return /^(03|05|07|08|09)[0-9]{8}$/.test(cleaned);
}

// ── Scanner error types ──────────────────────────────────────────
export type ScannerError = 
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA' 
  | 'HTTPS_REQUIRED'
  | 'UNKNOWN_ERROR'
  | 'UNKNOWN'
  | 'NOT_READABLE'
  | 'TIMEOUT';

// ── Camera controls ──────────────────────────────────────────────
let currentControls: IScannerControls | null = null;
let currentPreviewStream: MediaStream | null = null;

/** Apply zoom level to the current camera preview (1.0 = normal, 2.0 = 2x zoom, etc.)
 *  Returns true if hardware zoom was applied, false if not supported. */
export async function setPreviewZoom(level: number): Promise<boolean> {
  if (!currentPreviewStream) return false;
  const track = currentPreviewStream.getVideoTracks()[0];
  if (!track) return false;
  try {
    const capabilities = track.getCapabilities() as any;
    if (capabilities?.zoom) {
      const { min, max } = capabilities.zoom;
      const clamped = Math.max(min, Math.min(max, level));
      await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
      console.log(`[Scanner] Hardware zoom applied: ${clamped}x`);
      return true;
    }
  } catch {
    // Zoom not supported on this device/browser
  }
  console.log('[Scanner] Hardware zoom not supported');
  return false;
}

/** Get zoom capabilities of current camera (returns null if zoom not supported) */
export function getZoomCapabilities(): { min: number; max: number; step: number } | null {
  if (!currentPreviewStream) return null;
  const track = currentPreviewStream.getVideoTracks()[0];
  if (!track) return null;
  try {
    const capabilities = track.getCapabilities() as any;
    if (capabilities?.zoom) {
      return {
        min: capabilities.zoom.min ?? 1,
        max: Math.min(capabilities.zoom.max ?? 5, 5),
        step: capabilities.zoom.step ?? 0.1,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function startScan(
  videoElement: HTMLVideoElement,
  onResult: (result: string) => void,
  onError: (err: ScannerError, message: string) => void,
): () => void {
  if (currentControls) {
    currentControls.stop();
    currentControls = null;
  }

  const reader = createReader();

  const cleanup = () => {
    if (currentControls) {
      currentControls.stop();
      currentControls = null;
    }
  };

  // Check HTTPS requirement
  if (
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    !window.location.hostname.includes('localhost') &&
    window.location.hostname !== '127.0.0.1'
  ) {
    onError(
      'HTTPS_REQUIRED',
      'Camera yêu cầu HTTPS. Vui lòng truy cập qua HTTPS hoặc localhost.',
    );
    return cleanup;
  }

  reader
    .decodeFromVideoDevice(undefined, videoElement, (result, error) => {
      if (result) {
        const text = result.getText()?.trim()?.toUpperCase();
        if (text && isValidBarcode(text)) {
          onResult(text);
        }
      }
    })
    .then((controls) => {
      currentControls = controls;
    })
    .catch((error) => {
      console.error('Camera error:', error);
      
      if (error.name === 'NotAllowedError') {
        onError('PERMISSION_DENIED', 'Quyền camera bị từ chối');
      } else if (error.name === 'NotFoundError') {
        onError('NO_CAMERA', 'Không tìm thấy camera');
      } else {
        onError('UNKNOWN_ERROR', `Lỗi camera: ${error.message}`);
      }
    });

  return cleanup;
}

export function stopScan(): void {
  if (currentControls) {
    currentControls.stop();
    currentControls = null;
  }
}

// ── Camera preview for photo capture ──
export function startCameraPreview(
  videoElement: HTMLVideoElement,
  onError: (err: ScannerError, message: string) => void,
): () => void {
  const cleanup = () => {
    stopScan();
    if (currentPreviewStream) {
      currentPreviewStream.getTracks().forEach((t) => t.stop());
      currentPreviewStream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
      // Pause video to ensure play() isn't running
      try {
        videoElement.pause();
      } catch {
        // ignore
      }
    }
  };

  // Check HTTPS requirement
  if (
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    !window.location.hostname.includes('localhost') &&
    window.location.hostname !== '127.0.0.1'
  ) {
    onError(
      'HTTPS_REQUIRED',
      'Camera yêu cầu HTTPS. Vui lòng truy cập qua HTTPS hoặc localhost.',
    );
    return cleanup;
  }

  (async () => {
    try {
      // Stop old stream first and clear video element
      if (currentPreviewStream) {
        currentPreviewStream.getTracks().forEach((t) => t.stop());
        currentPreviewStream = null;
      }
      
      // Clear and pause video element before assigning new stream
      if (videoElement.srcObject) {
        try {
          videoElement.pause();
        } catch {
          // ignore
        }
        videoElement.srcObject = null;
        // Small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { min: 1280, ideal: 1920, max: 2560 },
          height: { min: 720, ideal: 1080, max: 1440 },
        },
      });
      
      // Double-check video element is still available (user might have closed camera)
      if (!videoElement) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      currentPreviewStream = stream;
      videoElement.srcObject = stream;
      
      // Apply crisp rendering to video element to prevent blur
      (videoElement as any).style.imageRendering = 'crisp-edges';
      
      // Wait for camera to stabilize and autofocus lock (1-1.5s)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      try {
        await videoElement.play();
        
        // Log actual camera resolution achieved
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          console.log(`[Camera] ✅ Stream resolution: ${settings.width}×${settings.height}, FPS: ${settings.frameRate}, Autofocus: ${settings.focusMode}`);
        }
      } catch (playError: any) {
        // If play() fails with interrupt error, try once more
        if (playError.name === 'AbortError') {
          console.log('[Camera] Retrying play() after abort...');
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoElement.play();
        } else {
          throw playError;
        }
      }
    } catch (error: any) {
      console.error('Camera preview error:', error);
      currentPreviewStream = null;
      
      if (error.name === 'NotAllowedError') {
        onError('PERMISSION_DENIED', 'Quyền camera bị từ chối');
      } else if (error.name === 'NotFoundError') {
        onError('NO_CAMERA', 'Không tìm thấy camera');
      } else {
        onError('UNKNOWN_ERROR', `Lỗi camera: ${error.message}`);
      }
    }
  })();

  return cleanup;
}

// ── Continuous auto-scan from existing preview stream ──
// Uses the SAME video element (no new stream) — avoids play() conflict
// Crops center region + applies enhancement for small barcodes
export function startAutoScanFromStream(
  videoElement: HTMLVideoElement,
  onResult: (barcode: string) => void,
  options?: { intervalMs?: number },
): () => void {
  const interval = options?.intervalMs ?? 350; // scan every 350ms for responsiveness
  let stopped = false;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let lastDetected = '';
  let lastDetectedTime = 0;
  let scanIndex = 0; // rotate through strategies each frame

  // Define crop regions: (sx%, sy%, sw%, sh%) relative to video dimensions
  // We focus on the center area where the user aims the barcode
  const cropRegions = [
    { sx: 0.10, sy: 0.20, sw: 0.80, sh: 0.60, label: 'center-wide' },      // wide center
    { sx: 0.05, sy: 0.30, sw: 0.90, sh: 0.40, label: 'center-strip' },      // horizontal strip
    { sx: 0.15, sy: 0.25, sw: 0.70, sh: 0.50, label: 'center-box' },        // center box
    { sx: 0.00, sy: 0.00, sw: 1.00, sh: 1.00, label: 'full-frame' },        // full frame fallback
    { sx: 0.20, sy: 0.35, sw: 0.60, sh: 0.30, label: 'center-narrow' },     // narrow center
  ];

  // Enhancement modes to rotate through
  const enhancements = ['none', 'contrast', 'grayscale', 'binary'];

  const tryDecode = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    const readers = [createMultiReader(), createReader()];
    for (const reader of readers) {
      if (stopped) return null;
      try {
        const result = await reader.decodeFromCanvas(canvas);
        if (result) {
          const text = result.getText()?.trim()?.toUpperCase();
          if (text && isValidBarcode(text)) return text;
        }
      } catch {
        // continue
      }
    }
    return null;
  };

  const scanFrame = async () => {
    if (stopped) return;
    if (!videoElement || videoElement.readyState < 2) return; // HAVE_CURRENT_DATA

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    if (vw === 0 || vh === 0) return;

    try {
      // Rotate through crop regions + enhancements
      const cropIdx = scanIndex % cropRegions.length;
      const enhIdx = Math.floor(scanIndex / cropRegions.length) % enhancements.length;
      scanIndex++;

      const crop = cropRegions[cropIdx];
      const enhance = enhancements[enhIdx];

      const sx = Math.floor(vw * crop.sx);
      const sy = Math.floor(vh * crop.sy);
      const sw = Math.floor(vw * crop.sw);
      const sh = Math.floor(vh * crop.sh);

      // Create canvas at 2x size for better small barcode detection
      const upscale = 2.0;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.floor(sw * upscale);
      canvas.height = Math.floor(sh * upscale);

      ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // Apply enhancement
      if (enhance !== 'none') {
        enhanceImage(ctx, canvas, enhance);
      }

      const text = await tryDecode(canvas);
      if (text) {
        const now = Date.now();
        if (text !== lastDetected || now - lastDetectedTime > 3000) {
          lastDetected = text;
          lastDetectedTime = now;
          console.log(`🎯 Auto-scan [${crop.label}+${enhance}]:`, text);
          onResult(text);
        }
      }
    } catch (err) {
      // Frame grab failed, will retry next interval
    }
  };

  // Start periodic scanning
  timerId = setInterval(scanFrame, interval);
  // First scan after video is ready
  setTimeout(scanFrame, 400);

  const cleanup = () => {
    stopped = true;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  return cleanup;
}

// ── Capture photo from video and decode ──
export async function captureAndDecode(videoElement: HTMLVideoElement): Promise<{
  imageData: string;
  barcode?: string;
  debugInfo?: string;
}> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Không thể tạo canvas context');
  }

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  
  // Convert to File for enhanced detection
  const response = await fetch(imageData);
  const blob = await response.blob();
  const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
  
  const result = await decodeFromImageFile(file);
  return {
    imageData,
    barcode: result.barcode,
    debugInfo: result.debugInfo
  };
}

/** 
 * Decode barcode from a cropped photo (data URL or Blob)
 * This MUST be used instead of captureAndDecode when you have a pre-cropped photo
 * 
 * @param dataUrl - Base64 data URL from canvas.toDataURL()
 * @param cropRect - Optional: crop rectangle info for logging
 * @returns Promise with barcode and debug info
 */
export async function decodeFromCroppedPhoto(
  dataUrl: string,
  cropRect?: { x: number; y: number; width: number; height: number },
): Promise<{
  barcode?: string;
  debugInfo?: string;
}> {
  try {
    // Convert data URL to File
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'cropped-photo.jpg', { type: 'image/jpeg' });
    
    const result = await decodeFromImageFile(file);
    
    let debugInfo = result.debugInfo || '';
    if (cropRect) {
      debugInfo = `Cropped(${cropRect.width}x${cropRect.height}@${cropRect.x},${cropRect.y}). ${debugInfo}`;
    }
    
    return {
      barcode: result.barcode,
      debugInfo,
    };
  } catch (err) {
    console.error('[decodeFromCroppedPhoto] Error:', err);
    throw err;
  }
}