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
  
  // ⭐ Mobile optimization: Calculate adaptive threshold based on image histogram
  // Instead of fixed threshold, adapt to actual lighting conditions
  let adaptiveThreshold = 128;
  if (enhanceType === 'contrast' || enhanceType === 'binary' || enhanceType === 'extreme') {
    // Build histogram to find optimal threshold
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
    }
    
    // Otsu's method for optimal threshold calculation
    let sumFg = 0, sumBg = 0, totalPixels = 0;
    for (let i = 0; i < 256; i++) {
      totalPixels += histogram[i];
    }
    
    let maxVar = 0;
    for (let t = 0; t < 256; t++) {
      sumFg += t * histogram[t];
      const wFg = 0;
      let wBg = totalPixels;
      for (let i = 0; i <= t; i++) wBg -= histogram[i];
      
      if (wFg === 0 || wBg === 0) continue;
      
      const muFg = sumFg / wFg;
      const muBg = (sumFg - sumFg) / wBg;
      const varBetween = wFg * wBg * Math.pow(muFg - muBg, 2);
      
      if (varBetween > maxVar) {
        maxVar = varBetween;
        adaptiveThreshold = t;
      }
    }
    
    // Clamp threshold to reasonable range for barcode detection
    adaptiveThreshold = Math.max(80, Math.min(180, adaptiveThreshold));
  }
  
  switch (enhanceType) {
    case 'grayscale':
      // Pure grayscale (no thresholding) - helps ZXing's internal processing
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      break;
    
    case 'contrast':
      // ⭐ Mobile: Use adaptive threshold instead of fixed 140
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const enhanced = gray > adaptiveThreshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = enhanced;
      }
      break;
      
    case 'binary':
      // ⭐ Mobile: Use adaptive threshold instead of fixed 128
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const binary = gray > adaptiveThreshold ? 255 : 0;
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
          
          // ⭐ Enhanced sharpening kernel for barcode clarity
          const enhanced = Math.max(0, Math.min(255, center * 5 - top - bottom - left - right));
          sharpened[i] = sharpened[i + 1] = sharpened[i + 2] = enhanced;
        }
      }
      data.set(sharpened);
      break;
      
    case 'extreme':
      // ⭐ Mobile: Use adaptive threshold instead of fixed 120
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        // For extreme mode, use even more aggressive thresholding
        const threshold = Math.max(100, adaptiveThreshold - 30);
        const enhanced = gray > threshold ? 255 : 0;
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

// ── Helper: Get optimal video constraints for device (S20 FE: prefer 4:3) ──
// Returns fallback chain: try 4:3 first (sharper barcode), then 16:9 (baseline)
function getOptimalVideoConstraints(priority: '4:3' | '16:9' = '4:3'): Array<{ video: any; label: string }> {
  const constraints: Array<{ video: any; label: string }> = [];
  
  if (priority === '4:3') {
    // For S20 FE: 4:3 often yields sharper barcode capture
    constraints.push({
      label: '4:3 (S20 FE optimized)',
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1440, min: 1024 },
        height: { ideal: 1920, min: 768 },
        aspectRatio: { ideal: 4 / 3 },
        frameRate: { ideal: 30, max: 60 },
        autoGainControl: true,
        noiseSuppression: false,
        echoCancellation: false,
      } as any,
    });
  }
  
  // Fallback: 16:9 baseline (original config)
  constraints.push({
    label: '16:9 (baseline)',
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, max: 60 },
      autoGainControl: true,
      noiseSuppression: false,
      echoCancellation: false,
    } as any,
  });
  
  return constraints;
}

// ── Helper: Apply advanced camera constraints (Samsung S20 FE optimized) ──
async function applyAdvancedConstraints(track: MediaStreamTrack): Promise<void> {
  if (!track || !(track as any).getCapabilities) return;
  
  const capabilities = (track as any).getCapabilities();
  const advancedConstraints: any[] = [];
  
  // ── Core constraints (always try) ──
  // Focus mode: Try continuous first, but on mobile might need manual trigger + focus power
  if (capabilities.focusMode) {
    if (capabilities.focusMode.includes('continuous')) {
      advancedConstraints.push({ focusMode: 'continuous' });
      console.log('[Camera] ✓ focusMode=continuous (barcode detail) [mobile-optimized]');
    } else if (capabilities.focusMode.includes('auto')) {
      // Fallback to auto focus if continuous not available
      advancedConstraints.push({ focusMode: 'auto' });
      console.log('[Camera] ✓ focusMode=auto (fallback, mobile device)');
    }
  }
  
  // Focus Power/Distance: For devices that support it, set for close-range barcode detection
  if (capabilities.focusDistance?.min !== undefined) {
    // Set focus to near distance (better for barcodes typically 10-30cm away)
    const minFocusDistance = capabilities.focusDistance.min || 0;
    const optimalDistance = Math.max(minFocusDistance, 0.1);  // 0.1m ≈ 10cm
    advancedConstraints.push({ focusDistance: optimalDistance });
    console.log(`[Camera] ✓ focusDistance=${optimalDistance.toFixed(2)}m (close-range for barcode)`);
  }
  
  if (capabilities.exposureMode?.includes('continuous')) {
    advancedConstraints.push({ exposureMode: 'continuous' });
    console.log('[Camera] ✓ exposureMode=continuous (stable brightness)');
  }
  
  if (capabilities.whiteBalanceMode?.includes('continuous')) {
    advancedConstraints.push({ whiteBalanceMode: 'continuous' });
    console.log('[Camera] ✓ whiteBalanceMode=continuous');
  }
  
  // ── S20 FE specific: Image quality enhancements ──
  if (capabilities.sharpness !== undefined) {
    const maxSharp = capabilities.sharpness.max || 100;
    advancedConstraints.push({ sharpness: maxSharp });
    console.log(`[Camera] ✓ sharpness=${maxSharp} (MAX for S20 FE)`);
  }
  
  // Contrast: mid-to-high for barcode detection
  if (capabilities.contrast !== undefined) {
    const minContrast = capabilities.contrast.min || 0;
    const maxContrast = capabilities.contrast.max || 100;
    const targetContrast = minContrast + (maxContrast - minContrast) * 0.7;
    advancedConstraints.push({ contrast: Math.round(targetContrast) });
    console.log(`[Camera] ✓ contrast=${Math.round(targetContrast)} (70% of max)`);
  }
  
  // ISO: keep noise low for barcode clarity
  if (capabilities.iso !== undefined) {
    const maxIso = Math.min(capabilities.iso.max || 400, 200);
    advancedConstraints.push({ iso: maxIso });
    console.log(`[Camera] ✓ iso=${maxIso} (noise control)`);
  }
  
  // Exposure time: fast shutter for sharp capture
  if (capabilities.exposureTime !== undefined) {
    const maxExposure = capabilities.exposureTime.max || 120;
    const targetExposure = Math.min(maxExposure, 120); // Cap at 120ms for S20 FE
    advancedConstraints.push({ exposureTime: [targetExposure] });
    console.log(`[Camera] ✓ exposureTime=${targetExposure}ms (sharp capture)`);
  }
  
  // Zoom: moderate for stability
  if (capabilities.zoom?.min !== undefined && capabilities.zoom?.max !== undefined) {
    const maxZoom = Math.min(capabilities.zoom.max, 2.0);
    advancedConstraints.push({ zoom: maxZoom });
    console.log(`[Camera] ✓ zoom=${maxZoom}x (stability)`);
  }
  
  // Exposure compensation (conditional): reduce when torch is ON
  if (torchEnabled && capabilities.exposureCompensation) {
    const minComp = capabilities.exposureCompensation.min || -3;
    const targetComp = Math.max(minComp, -0.5);
    advancedConstraints.push({ exposureCompensation: targetComp });
    console.log(`[Camera] ✓ exposureCompensation=${targetComp} (torch ON)`);
  }
  
  if (advancedConstraints.length > 0) {
    try {
      await (track as any).applyConstraints({ advanced: advancedConstraints });
    } catch (err: any) {
      console.log('[Camera] ⚠️ applyConstraints warning:', err.message);
    }
  }
}

// ── Helper: Capture photo via ImageCapture API if available (S20 FE feature) ──
async function capturePhotoViaImageCapture(track: MediaStreamTrack): Promise<Blob | null> {
  try {
    // Check if ImageCapture is supported (Chrome/Android typically have it)
    if (!('ImageCapture' in window)) {
      console.log('[Capture] ImageCapture not supported, using fallback canvas');
      return null;
    }
    
    const imageCapture = new (window as any).ImageCapture(track);
    console.log('[Capture] 📸 Using ImageCapture.takePhoto() for best quality');
    
    const blob = await imageCapture.takePhoto({
      imageWidth: track.getSettings().width,
      imageHeight: track.getSettings().height,
    });
    
    console.log(`[Capture] ✓ ImageCapture success: ${blob.size} bytes`);
    return blob;
  } catch (err: any) {
    console.warn('[Capture] ImageCapture failed, falling back to canvas:', err.message);
    return null;
  }
}

// ── Helper: Quality check for stream resolution ──
function checkStreamQuality(settings: MediaTrackSettings): { ok: boolean; reason: string } {
  const width = settings.width || 0;
  const height = settings.height || 0;
  const longSide = Math.max(width, height);
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  
  if (longSide < 1280) {
    return { ok: false, reason: `LongSide ${longSide} < 1280` };
  }
  
  if (aspectRatio < 0.6) {
    // Very narrow aspect (like 9:16) - might be portrait crop
    return { ok: true, reason: `Portrait: ${width}×${height} (4:3-ish)` };
  }
  
  return { ok: true, reason: `Landscape: ${width}×${height} (16:9)` };
}

// ── Camera preview with fallback 4:3 → 16:9 for S20 FE optimization ──
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

      // ── PATCH S20 FE: Fallback chain 4:3 → 16:9 for barcode clarity ──
      const constraintChain = getOptimalVideoConstraints('4:3');
      let stream: MediaStream | null = null;
      let selectedConstraint: string = '';
      
      for (const constraint of constraintChain) {
        try {
          console.log(`[Camera] Trying constraint: ${constraint.label}`);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: constraint.video,
          });
          selectedConstraint = constraint.label;
          console.log(`[Camera] ✓ Acquired stream: ${selectedConstraint}`);
          break;
        } catch (err: any) {
          console.log(`[Camera] ✗ ${constraint.label} failed: ${err.message}`);
          // Try next constraint
        }
      }
      
      if (!stream) {
        throw new Error('All constraint attempts failed');
      }
      
      // Check actual stream resolution
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        stream.getTracks().forEach(t => t.stop());
        onError('UNKNOWN_ERROR', 'Không thể lấy video track từ stream');
        return;
      }
      
      const streamSettings = videoTrack.getSettings();
      const streamWidth = streamSettings.width || 0;
      const streamHeight = streamSettings.height || 0;
      const streamFps = streamSettings.frameRate || 0;
      const streamAspect = (streamWidth / streamHeight).toFixed(2);
      
      // Quality check
      const qualityCheck = checkStreamQuality(streamSettings);
      const longSide = Math.max(streamWidth, streamHeight);
      const shortSide = Math.min(streamWidth, streamHeight);
      const isPortrait = streamHeight > streamWidth;
      
      console.log(`[Camera] Stream acquired: ${streamWidth}×${streamHeight} @ ${streamFps.toFixed(1)}fps (aspect=${streamAspect})`);
      console.log(`[Camera] Constraint: ${selectedConstraint}`);
      console.log(`[Camera] Quality: ${qualityCheck.reason}`);
      console.log(`[Camera] Portrait: ${isPortrait}, LongSide: ${longSide}, ShortSide: ${shortSide}`);
      console.log(`[Camera] track.getSettings():`, streamSettings);
      
      if (!qualityCheck.ok) {
        console.warn(`[Camera] ⚠️ Stream quality issue: ${qualityCheck.reason}`);
      }
      
      // Double-check video element is still available
      if (!videoElement) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      currentPreviewStream = stream;
      videoElement.srcObject = stream;
      
      // ── TASK E: Configure video element for S20 FE barcode clarity ──
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('disablepictureinpicture', 'true');
      // CRITICAL: objectFit contain (not cover) for barcode clarity
      (videoElement as any).style.backfaceVisibility = 'hidden';
      (videoElement as any).style.WebkitBackfaceVisibility = 'hidden';
      (videoElement as any).style.filter = 'none';
      (videoElement as any).style.objectFit = 'contain';              // S20 FE: contain for clarity
      (videoElement as any).style.objectPosition = 'center';
      (videoElement as any).style.WebkitFontSmoothing = 'antialiased';
      (videoElement as any).style.textRendering = 'geometricPrecision';
      (videoElement as any).style.lineHeight = '0';
      (videoElement as any).style.fontSize = '0';
      
      // ── TASK C: Wait for video to be truly ready ──
      try {
        await videoElement.play();
      } catch (playError: any) {
        if (playError.name === 'AbortError') {
          console.log('[Camera] Play aborted, retrying...');
          await new Promise(resolve => setTimeout(resolve, 200));
          await videoElement.play();
        } else {
          throw playError;
        }
      }
      
      // Wait for video bytes to start flowing
      const maxRetries = 30;
      let retries = 0;
      while (retries < maxRetries && (videoElement.readyState < 2 || videoElement.videoWidth === 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (videoElement.readyState < 2 || videoElement.videoWidth === 0) {
        throw new Error('Video did not reach HAVE_CURRENT_DATA state');
      }
      
      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;
      const vLong = Math.max(vw, vh);
      const vOk = vLong >= 1280;
      console.log(`[Camera] Video ready: ${vw}×${vh} (longSide=${vLong})`);
      console.log(`[Camera] Video quality OK: ${vOk}`);
      
      // ── TASK B: Apply advanced constraints IMMEDIATELY (S20 FE optimized) ──
      await applyAdvancedConstraints(videoTrack);
      
      // ⭐ Mobile optimization: Extend focus settling to 2500ms for maximum autofocus stability
      // Mobile devices need more time to properly lock focus, especially with barcode close-up
      // 1500ms was still too short for many devices
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      (videoElement as any).dataset.focusLocked = 'true';
      console.log('[Camera] ✅ Focus/Exposure settled - Ready for capture');
    } catch (error: any) {
      console.error('[Camera] Preview error:', error);
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

// ── Torch control: Manual toggle (not auto-on) ──
// When torch is enabled, reduce exposure compensation to prevent overexposure
let torchEnabled = false;

export async function toggleTorch(enable: boolean): Promise<boolean> {
  if (!currentPreviewStream) {
    console.warn('[Torch] No active stream to control torch');
    return false;
  }

  try {
    const track = currentPreviewStream.getVideoTracks()[0];
    if (!track) {
      console.warn('[Torch] No video track found');
      return false;
    }

    const capabilities = (track as any).getCapabilities?.();
    if (!capabilities) {
      console.warn('[Torch] Cannot get track capabilities');
      return false;
    }

    // Check if torch is supported
    if (!capabilities.torch) {
      console.warn('[Torch] Torch not supported on this device');
      return false;
    }

    // Apply torch constraint
    await (track as any).applyConstraints({
      advanced: [{ torch: enable }]
    });

    // When torch is ON, reduce exposure compensation to avoid overexposure
    if (enable && capabilities.exposureCompensation) {
      const compensation = Math.max(
        capabilities.exposureCompensation.min || -3,
        -0.5  // Reduce by 0.5 stops
      );
      await (track as any).applyConstraints({
        advanced: [{ exposureCompensation: compensation }]
      });
      console.log(`[Torch] ✓ ON + exposureCompensation=${compensation}`);
    } else if (!enable && capabilities.exposureCompensation) {
      // Reset exposure compensation when torch is OFF
      await (track as any).applyConstraints({
        advanced: [{ exposureCompensation: 0 }]
      });
      console.log('[Torch] ✗ OFF (exposure reset)');
    } else {
      console.log(`[Torch] ${enable ? '✓ ON' : '✗ OFF'}`);
    }

    torchEnabled = enable;
    return true;
  } catch (err) {
    console.error('[Torch] Control error:', err);
    return false;
  }
}

export function getTorchState(): boolean {
  return torchEnabled;
}

// ── Continuous auto-scan from existing preview stream ──
// Uses the SAME video element (no new stream) — avoids play() conflict
// Crops center region + applies enhancement for small barcodes
export function startAutoScanFromStream(
  videoElement: HTMLVideoElement,
  onResult: (barcode: string) => void,
  options?: { 
    intervalMs?: number;
    onBarcodeDetected?: (canvas: HTMLCanvasElement, barcode: string) => void;
  },
): () => void {
  const interval = options?.intervalMs ?? 350; // scan every 350ms for responsiveness
  const onBarcodeDetected = options?.onBarcodeDetected;
  let stopped = false;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let lastDetected = '';
  let lastDetectedTime = 0;
  let scanIndex = 0; // rotate through strategies each frame

  // Define crop regions: (sx%, sy%, sw%, sh%) relative to video dimensions
  // ⭐ Mobile optimization: Expanded regions to cover more of frame
  // Include edges since barcode might not always be perfectly centered
  const cropRegions = [
    { sx: 0.05, sy: 0.15, sw: 0.90, sh: 0.70, label: 'full-wide' },        // ⭐ NEW: wider coverage
    { sx: 0.10, sy: 0.20, sw: 0.80, sh: 0.60, label: 'center-wide' },      // Center wide
    { sx: 0.05, sy: 0.25, sw: 0.90, sh: 0.50, label: 'center-strip' },     // Horizontal strip
    { sx: 0.15, sy: 0.25, sw: 0.70, sh: 0.50, label: 'center-box' },       // Center box
    { sx: 0.00, sy: 0.10, sw: 1.00, sh: 0.80, label: 'full-frame' },       // ⭐ NEW: almost full frame
    { sx: 0.20, sy: 0.30, sw: 0.60, sh: 0.40, label: 'center-narrow' },    // Narrow center
    { sx: 0.00, sy: 0.00, sw: 1.00, sh: 1.00, label: 'complete-frame' },   // ⭐ NEW: absolute full frame
  ];

  // Enhancement modes to rotate through
  // ⭐ Mobile: More modes for better coverage, order optimized for mobile
  const enhancements = ['none', 'grayscale', 'contrast', 'sharpen', 'binary', 'extreme'];

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

      // ⭐ Mobile optimization: Adaptive upscaling based on crop size
      // Small crop → higher upscale; Large crop → lower upscale
      // This maintains barcode detection accuracy on all device sizes
      let upscale = 1.8;
      if (sw > 400) upscale = 1.5;  // Already large crop, less upscale needed
      if (sw > 600) upscale = 1.2;  // Full width crop, minimal upscale
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
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
          
          // ⭐ FREEZE DETECTION CANVAS: Capture at detection moment, not later
          if (onBarcodeDetected) {
            console.log(`[AutoScan] 📸 Freezing ROI canvas at detection time (${canvas.width}×${canvas.height})`);
            onBarcodeDetected(canvas, text);
          }
          
          onResult(text);
        }
      }
    } catch (err) {
      // Frame grab failed, will retry next interval
    }
  };

  // ⭐ Mobile optimization: Faster scan interval with new algorithm improvements
  // Original 350ms was aggressive, then 600ms was too slow
  // Back to 400ms now with better image processing (adaptive thresholding)
  const mobileInterval = Math.max(interval, 400);
  timerId = setInterval(scanFrame, mobileInterval);
  // First scan after focus settles
  setTimeout(scanFrame, 1000);

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

/** 
 * Get current camera stream debug info (resolution, capabilities, etc.)
 * Useful for troubleshooting low-res captures.
 */
export function getCameraDebugInfo(): {
  streamActive: boolean;
  streamWidth?: number;
  streamHeight?: number;
  streamFps?: number;
  zoomSupported?: boolean;
  focusSupported?: boolean;
  exposureSupported?: boolean;
} | null {
  if (!currentPreviewStream) return null;
  
  const track = currentPreviewStream.getVideoTracks()[0];
  if (!track) return null;
  
  try {
    const settings = track.getSettings();
    const capabilities = (track as any).getCapabilities?.();
    
    return {
      streamActive: track.readyState === 'live',
      streamWidth: settings.width,
      streamHeight: settings.height,
      streamFps: settings.frameRate,
      zoomSupported: capabilities?.zoom?.min !== undefined,
      focusSupported: capabilities?.focusMode !== undefined,
      exposureSupported: capabilities?.exposureMode !== undefined,
    };
  } catch {
    return { streamActive: track.readyState === 'live' };
  }
}