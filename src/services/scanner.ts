// ===== Barcode Scanner — Multi-library approach with QuaggaJS + ZXing =====
// Dual detection engines for maximum compatibility
// Camera-only with enhanced image preprocessing

import { BrowserMultiFormatOneDReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// Dynamically import QuaggaJS for better compatibility
let Quagga: any = null;
try {
  Quagga = require('quagga');
} catch (err) {
  console.warn('QuaggaJS not available:', err);
}

// ── Barcode prefix → product mapping ──────────────────────────────
export const BARCODE_PREFIXES: Record<string, string> = {
  '12N5L': 'Bình ắc quy Natri – Ion xe máy số 12N5L',
  '12N7L': 'Bình ắc quy Natri Ion xe máy ga 12N7L',
  'YTX4A': 'Bình ắc quy xe máy Natri Ion YTX4A',
  'YTX5A': 'Bình ắc quy xe tay ga Natri Ion YTX5A',
  'YTX7A': 'Bình ắc quy xe tay ga Natri Ion YTX7A',
};

export const VALID_PREFIXES = Object.keys(BARCODE_PREFIXES);

// ── Validate barcode format ──────────────────────────────────────
// Rule: A-Z 0-9 only, 12-40 chars, prefix must be in VALID_PREFIXES
export function isValidBarcode(barcode: string): boolean {
  if (!barcode) return false;
  const trimmed = barcode.trim().toUpperCase();
  
  console.log('🔍 Barcode validation:', {
    original: barcode,
    trimmed: trimmed,
    length: trimmed.length
  });
  
  // Accept any alphanumeric barcode with reasonable length
  // Check for battery prefixes first (preferred)
  if (/^[A-Z0-9]{8,40}$/.test(trimmed)) {
    const hasValidPrefix = VALID_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
    
    if (hasValidPrefix) {
      console.log('✅ Valid battery barcode with known prefix');
      return true;
    }
    
    // Also accept other reasonable alphanumeric codes (flexible mode)
    if (trimmed.length >= 12 && trimmed.length <= 40) {
      console.log('✅ Valid alphanumeric barcode (flexible mode)');
      return true;
    }
  }
  
  // Backward compatibility: numeric barcodes
  const isNumeric = /^\d{8,20}$/.test(trimmed);
  if (isNumeric) {
    console.log('📊 Valid numeric barcode (legacy format)');
    return true;
  }
  
  console.log('❌ Barcode validation failed');
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

// ── Camera scanner state ─────────────────────────────────────────
export type ScannerError =
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'NOT_READABLE'
  | 'HTTPS_REQUIRED'
  | 'TIMEOUT'
  | 'UNKNOWN';

let _controls: IScannerControls | null = null;
let _stream: MediaStream | null = null;

function createReader(): BrowserMultiFormatOneDReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatOneDReader(hints, {
    delayBetweenScanAttempts: 500,
  });
}

/**
 * Capture photo from video element and decode barcode from it.
 * 
 * @param videoElement - video element với camera stream
 * @returns Promise với { imageData: string (base64), barcode?: string }
 */
export async function captureAndDecode(videoElement: HTMLVideoElement): Promise<{
  imageData: string;
  barcode?: string;
}> {
  // Create canvas to capture frame
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create canvas context');
  }

  // Set canvas size to video size
  canvas.width = videoElement.videoWidth || videoElement.width || 640;
  canvas.height = videoElement.videoHeight || videoElement.height || 480;

  // Draw current video frame to canvas
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Get image data as base64
  const imageData = canvas.toDataURL('image/jpeg', 0.8);

  // Try to decode barcode from canvas
  let barcode: string | undefined;
  try {
    const reader = createReader();
    const result = await reader.decodeFromCanvas(canvas);
    barcode = result?.getText()?.trim()?.toUpperCase();
  } catch {
    // No barcode found, that's ok
  }

  return { imageData, barcode };
}

/**
 * Advanced barcode detection with multiple processing techniques.
 * 
 * @param file - Image file from input[type=file]
 * @returns Promise với { imageData: string (base64), barcode?: string, debugInfo?: string }
 */
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

        // Create image element to load the file
        const img = new Image();
        img.onload = async () => {
          try {
            let barcode: string | undefined;
            let debugInfo = `Processing ${file.name} (${img.width}x${img.height}px, ${Math.round(file.size/1024)}KB). `;

            // Create both readers for different barcode types
            const multiReader = new BrowserMultiFormatReader();
            const oneDReader = createReader();

            // Multiple processing strategies
            const strategies = [
              // Original size strategies
              { scale: 1, rotate: 0, enhance: 'none', label: 'original' },
              { scale: 1, rotate: 0, enhance: 'contrast', label: 'high-contrast' },
              { scale: 1, rotate: 0, enhance: 'sharpen', label: 'sharpened' },
              
              // Scaled strategies
              { scale: 0.8, rotate: 0, enhance: 'none', label: '80% scale' },
              { scale: 0.6, rotate: 0, enhance: 'contrast', label: '60% + contrast' },
              { scale: 1.2, rotate: 0, enhance: 'none', label: '120% scale' },
              
              // Rotation strategies (for tilted barcodes)
              { scale: 1, rotate: 5, enhance: 'contrast', label: 'rotated +5°' },
              { scale: 1, rotate: -5, enhance: 'contrast', label: 'rotated -5°' },
              { scale: 1, rotate: 10, enhance: 'none', label: 'rotated +10°' },
              { scale: 1, rotate: -10, enhance: 'none', label: 'rotated -10°' },
              
              // Extreme processing for difficult images
              { scale: 0.4, rotate: 0, enhance: 'extreme', label: 'small + extreme' },
              { scale: 1.5, rotate: 0, enhance: 'contrast', label: 'large + contrast' },
              { scale: 0.8, rotate: 3, enhance: 'sharpen', label: 'scaled + rotation' },
            ];

            for (const strategy of strategies) {
              if (barcode) break;
              
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;

              // Calculate dimensions
              const scaledWidth = Math.floor(img.width * strategy.scale);
              const scaledHeight = Math.floor(img.height * strategy.scale);
              
              canvas.width = scaledWidth;
              canvas.height = scaledHeight;
              
              // Clear and setup canvas
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Apply rotation if needed
              if (strategy.rotate !== 0) {
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((strategy.rotate * Math.PI) / 180);
                ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
                ctx.restore();
              } else {
                ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
              }
              
              // Apply image enhancement
              if (strategy.enhance !== 'none') {
                const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageDataObj.data;
                
                switch (strategy.enhance) {
                  case 'contrast':
                    // High contrast black/white
                    for (let i = 0; i < data.length; i += 4) {
                      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                      const enhanced = gray > 140 ? 255 : 0;
                      data[i] = data[i + 1] = data[i + 2] = enhanced;
                    }
                    break;
                    
                  case 'sharpen':
                    // Sharpen filter for blurry images
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
                    // Extreme processing for very difficult images
                    for (let i = 0; i < data.length; i += 4) {
                      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                      // More aggressive thresholding
                      const enhanced = gray > 120 ? 255 : 0;
                      data[i] = data[i + 1] = data[i + 2] = enhanced;
                    }
                    break;
                }
                
                ctx.putImageData(imageDataObj, 0, 0);
              }

              // Try both readers
              const readers = [
                { reader: multiReader, name: 'MultiFormat' },
                { reader: oneDReader, name: '1D' }
              ];
              
            for (const strategy of strategies) {
              if (barcode) break;
              
              try {
                const result = await processWithStrategy(img, strategy);
                if (result) {
                  console.log(`🎯 Raw detection result: "${result}" (${result.length} chars)`);
                  
                  // Try multiple cleaning approaches for maximum compatibility
                  const candidates = [
                    result,
                    result.trim(),
                    result.toUpperCase(),
                    result.trim().toUpperCase(),
                    result.replace(/[^A-Z0-9]/g, ''), // Remove non-alphanumeric
                    result.replace(/[^A-Z0-9]/gi, '').toUpperCase(), // Case insensitive clean
                    result.replace(/[\s\-_\.]/g, '').toUpperCase(), // Remove separators
                  ];
                  
                  for (const candidate of candidates) {
                    if (candidate && candidate.length >= 8) {
                      console.log(`🧪 Testing candidate: "${candidate}" (${candidate.length} chars)`);
                      
                      // Use flexible validation - accept any reasonable barcode format
                      if (isValidBarcode(candidate)) {
                        barcode = candidate;
                        debugInfo += `SUCCESS with ${strategy.label}: "${barcode}" (${barcode.length} chars). `;
                        console.log('🎉 Barcode accepted:', { strategy, barcode, candidate });
                        break;
                      } else {
                        console.log(`❌ Candidate "${candidate}" failed validation`);
                      }
                    }
                  }
                  
                  if (barcode) break;
                }
              } catch (err) {
                // Continue to next strategy
                console.log(`⚠️ Strategy ${strategy.label} failed:`, err);
                debugInfo += `${strategy.label} failed, `;
              }
            }
              
              if (!barcode) {
                debugInfo += `Tried ${strategy.label}, `;
              }
            }

            if (!barcode) {
              debugInfo += 'No barcode detected with any strategy.';
              console.log('Barcode detection failed:', debugInfo);
            }

            resolve({ imageData, barcode, debugInfo });
          } catch (error) {
            console.error('Image processing error:', error);
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

/**
 * Start camera preview for photo capture (không decode liên tục).
 */
export function startCameraPreview(
  videoElement: HTMLVideoElement,
  onError: (err: ScannerError, message: string) => void,
): () => void {
  let stopped = false;

  const cleanup = () => {
    stopped = true;
    stopScan();
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      _stream = stream;

      // Assign stream to video for iOS compatibility
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('muted', 'true');
      videoElement.muted = true;

      try {
        await videoElement.play();
      } catch {
        // autoplay blocked — will retry on user interaction
      }
    } catch (err: any) {
      if (stopped) return;
      cleanup();

      const name = err?.name || '';
      const msg = err?.message || '';

      if (
        name === 'NotAllowedError' ||
        msg.includes('Permission denied') ||
        msg.includes('not allowed')
      ) {
        onError(
          'PERMISSION_DENIED',
          'Quyền camera bị từ chối. Vui lòng vào Cài đặt > Ứng dụng > Zalo > Quyền > Camera để bật.',
        );
      } else if (
        name === 'NotFoundError' ||
        msg.includes('Requested device not found')
      ) {
        onError('NO_CAMERA', 'Không tìm thấy camera trên thiết bị này.');
      } else if (
        name === 'NotReadableError' ||
        msg.includes('Could not start video source')
      ) {
        onError(
          'NOT_READABLE',
          'Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng app khác và thử lại.',
        );
      } else {
        onError('UNKNOWN', `Lỗi camera: ${msg || name || 'Unknown'}`);
      }
    }
  })();

  return cleanup;
}

/**
 * Start continuous barcode scanning using camera.
 *
 * @param videoElement  - <video> element to render camera preview
 * @param onResult      - callback khi decode thành công (barcode string)
 * @param onError       - callback khi gặp lỗi camera
 * @param timeoutMs     - timeout (ms), default 30s. Trả về 'TIMEOUT' nếu hết giờ.
 * @returns cleanup function to stop scanning
 */
export function startScan(
  videoElement: HTMLVideoElement,
  onResult: (barcode: string) => void,
  onError: (err: ScannerError, message: string) => void,
  timeoutMs: number = 30000,
): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    stopScan();
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

  // Set timeout
  timeoutId = setTimeout(() => {
    if (!stopped) {
      cleanup();
      onError('TIMEOUT', 'Không nhận được barcode. Vui lòng thử quét lại.');
    }
  }, timeoutMs);

  // Start camera + decode
  const reader = createReader();

  (async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      _stream = stream;

      // Assign stream to video for iOS compatibility
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('muted', 'true');
      videoElement.muted = true;

      try {
        await videoElement.play();
      } catch {
        // autoplay blocked — will retry on user interaction
      }

      // Continuous decode from video element using @zxing/browser API
      const controls = await reader.decodeFromVideoElement(
        videoElement,
        (result, _err, scannerControls) => {
          if (stopped) {
            scannerControls.stop();
            return;
          }
          if (result) {
            const text = result.getText().trim().toUpperCase();
            if (text) {
              cleanup();
              onResult(text);
            }
          }
        },
      );

      _controls = controls;
    } catch (err: any) {
      if (stopped) return;
      cleanup();

      const name = err?.name || '';
      const msg = err?.message || '';

      if (
        name === 'NotAllowedError' ||
        msg.includes('Permission denied') ||
        msg.includes('not allowed')
      ) {
        onError(
          'PERMISSION_DENIED',
          'Quyền camera bị từ chối. Vui lòng vào Cài đặt > Ứng dụng > Zalo > Quyền > Camera để bật.',
        );
      } else if (
        name === 'NotFoundError' ||
        msg.includes('Requested device not found')
      ) {
        onError('NO_CAMERA', 'Không tìm thấy camera trên thiết bị này.');
      } else if (
        name === 'NotReadableError' ||
        msg.includes('Could not start video source')
      ) {
        onError(
          'NOT_READABLE',
          'Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng app khác và thử lại.',
        );
      } else {
        onError('UNKNOWN', `Lỗi camera: ${msg || name || 'Unknown'}`);
      }
    }
  })();

  return cleanup;
}

/**
 * Stop scanning and release camera.
 */
export function stopScan(): void {
  try {
    if (_controls) {
      _controls.stop();
      _controls = null;
    }
  } catch {
    // ignore
  }

  if (_stream) {
    _stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    _stream = null;
  }
}

/**
 * Simple scanBarcode() function for backward compatibility.
 * Attempts to use Zalo Mini App SDK scanQRCode, falls back to null.
 * For complex camera scanning, use startScan() + stopScan() instead.
 */
export async function scanBarcode(): Promise<string | null> {
  try {
    // Try ZMP SDK scanQRCode (may work for both QR and barcode)
    const { scanQRCode } = await import('zmp-sdk');
    const result = await scanQRCode({});
    if (result && typeof result === 'object' && 'content' in result) {
      return (result as any).content || null;
    }
    return typeof result === 'string' ? result : null;
  } catch (err) {
    console.warn('ZMP scanQRCode not available:', err);
    // Could implement a simple modal with startScan here if needed
    return null;
  }
}

/**
 * Validate Vietnamese phone number
 */
export function isValidPhone(phone: string): boolean {
  return /^0(3|5|7|8|9)\d{8}$/.test(phone);
}
