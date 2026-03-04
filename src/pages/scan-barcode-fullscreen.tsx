// ===== Full-Screen Barcode Scanner — Auto-Scan Realtime =====
// Zalo Mini App optimized: full-screen camera + ROI auto-detect + realtime feedback

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'zmp-ui';
import { Box, Button, Text } from 'zmp-ui';
import { 
  isValidBarcode, 
  parseBarcodePrefix, 
  BARCODE_PREFIXES 
} from '@/services/scanner-enhanced';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { Result } from '@zxing/library';

// ── Auto-scan state ──
type ScannerState = 'initializing' | 'scanning' | 'detected' | 'error' | 'closed';

interface ScanResult {
  barcode: string;
  productName?: string;
  sku?: string;
  proofImageBlob?: Blob;
}

// ── ROI Canvas dimensions (% of video) ──
const ROI_CONFIG = {
  left: '12.5%',    // (100-75)/2 -> center with 75% width
  top: '30%',
  width: '75%',
  height: '40%',
};

// ── Create ZXing reader with hints ──
function createZXingReader() {
  return new BrowserMultiFormatReader();
}

// ── Compute source crop rect from DOM elements ──
function computeSourceCropRect(
  videoElement: HTMLVideoElement,
  frameElement: HTMLElement | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!frameElement) return null;

  const videoRect = videoElement.getBoundingClientRect();
  const frameRect = frameElement.getBoundingClientRect();

  // Find intersection
  const left = Math.max(videoRect.left, frameRect.left);
  const top = Math.max(videoRect.top, frameRect.top);
  const right = Math.min(videoRect.right, frameRect.right);
  const bottom = Math.min(videoRect.bottom, frameRect.bottom);

  if (left >= right || top >= bottom) return null;

  // Map UI pixels to video source pixels
  const scaleX = videoElement.videoWidth / videoRect.width;
  const scaleY = videoElement.videoHeight / videoRect.height;

  const sx = Math.max(0, Math.floor((left - videoRect.left) * scaleX));
  const sy = Math.max(0, Math.floor((top - videoRect.top) * scaleY));
  let sw = Math.floor((right - left) * scaleX);
  let sh = Math.floor((bottom - top) * scaleY);

  // Clamp to video bounds
  sw = Math.min(sw, videoElement.videoWidth - sx);
  sh = Math.min(sh, videoElement.videoHeight - sy);

  return { x: sx, y: sy, width: sw, height: sh };
}

// ── Decode from ROI canvas ──
async function decodeROI(canvas: HTMLCanvasElement): Promise<Result | null> {
  try {
    const reader = createZXingReader();
    const result = await reader.decodeFromCanvas(canvas);
    return result;
  } catch (err) {
    return null;
  }
}

interface ScanBarcodeFullScreenProps {
  onResult?: (result: ScanResult) => void;
}

function ScanBarcodeFullScreen(props: ScanBarcodeFullScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedRef = useRef(false);

  const [state, setState] = useState<ScannerState>('initializing');
  const [torch, setTorch] = useState(false);
  const [statusText, setStatusText] = useState('Khởi tạo camera...');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [detectedBarcode, setDetectedBarcode] = useState('');

  // ── Start camera stream ──
  const startCamera = useCallback(async () => {
    try {
      setStatusText('Yêu cầu quyền camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1440 },
          height: { ideal: 1920 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (!videoRef.current) throw new Error('Video element not found');

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Wait for video to load
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        videoRef.current?.addEventListener('loadedmetadata', onLoadedMetadata);
        // Timeout failsafe
        setTimeout(() => {
          videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        }, 2000);
      });

      console.log('✅ Camera stream ready');
      setStatusText('Sẵn sàng quét...');
      setState('scanning');
      setLastScanTime(Date.now());
    } catch (err) {
      console.error('Camera error:', err);
      setStatusText('Lỗi camera. Vui lòng kiểm tra quyền.');
      setState('error');
    }
  }, []);

  // ── Auto-scan loop ──
  const startAutoScan = useCallback(() => {
    const scanInterval = 300; // 300ms between scans
    let noDetectCount = 0;
    const maxNoDetectTime = 7000; // 7 seconds

    const scanLoop = async () => {
      if (detectedRef.current || state !== 'scanning' || !videoRef.current || !frameRef.current) {
        return;
      }

      try {
        // Compute ROI
        const crop = computeSourceCropRect(videoRef.current, frameRef.current);
        if (!crop) {
          console.warn('[ROI] No intersection');
          return;
        }

        // Draw ROI to canvas
        const roi = roiCanvasRef.current;
        if (!roi) return;

        roi.width = crop.width;
        roi.height = crop.height;
        const ctx = roi.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          videoRef.current,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height
        );

        // Decode
        const result = await decodeROI(roi);
        if (result && result.getText()) {
          const barcodeText = result.getText().trim().toUpperCase();
          
          if (isValidBarcode(barcodeText)) {
            console.log('✅ DETECTED:', barcodeText);
            detectedRef.current = true;
            setDetectedBarcode(barcodeText);
            setState('detected');

            // Freeze frame
            roi.toBlob((blob) => {
              if (blob) {
                const parsed = parseBarcodePrefix(barcodeText);
                const scanResult: ScanResult = {
                  barcode: barcodeText,
                  productName: parsed?.productName,
                  sku: parsed?.sku,
                  proofImageBlob: blob,
                };

                // Haptic feedback (if supported)
                if ('vibrate' in navigator) {
                  navigator.vibrate([100, 50, 100]);
                }

                // Call callback or navigate back
                if (props.onResult) {
                  props.onResult(scanResult);
                }

                // Pass result via state and navigate back
                setTimeout(() => {
                  // Store in sessionStorage for next page to pick up
                  sessionStorage.setItem('scanResult', barcodeText);
                  window.history.back();
                }, 800);
              }
            }, 'image/jpeg', 0.95);
            return;
          }
        }

        // Track scan attempts
        noDetectCount++;
        const elapsedTime = Date.now() - lastScanTime;
        if (elapsedTime > maxNoDetectTime && noDetectCount > 15) {
          setStatusText(
            '💡 Đưa gần hơn / Xoay tem 10-20° / Tắt flash nếu bị lóa'
          );
        } else if (noDetectCount % 3 === 0) {
          setStatusText('Đang quét...');
        }
      } catch (err) {
        // Silent fail, continue scanning
        console.debug('[Scan] Decode attempt:', err);
      }
    };

    // First scan after camera ready
    scanLoop();

    // Continuous scan loop
    scannerRef.current = setInterval(scanLoop, scanInterval);
  }, [state, lastScanTime, props, navigate, location]);

  // ── Initialize camera on mount ──
  useEffect(() => {
    startCamera();

    return () => {
      // Cleanup
      if (scannerRef.current) clearInterval(scannerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // ── Start auto-scan when state changes to 'scanning' ──
  useEffect(() => {
    if (state === 'scanning') {
      startAutoScan();
    }
  }, [state, startAutoScan]);

  // ── Torch toggle ──
  const handleTorchToggle = async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities() as any;
      if (!capabilities.torch) {
        console.warn('Torch not supported');
        return;
      }

      await track.applyConstraints({
        advanced: [{ torch: !torch } as any],
      });

      setTorch(!torch);
      console.log('[Torch]', torch ? 'OFF' : 'ON');
    } catch (err) {
      console.warn('[Torch] Error:', err);
    }
  };

  // ── Close scanner ──
  const handleClose = () => {
    if (scannerRef.current) clearInterval(scannerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setState('closed');
    navigate(-1);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
          display: 'block',
        }}
      />

      {/* ── ROI Frame ── */}
      <div
        ref={frameRef}
        style={{
          position: 'absolute',
          left: ROI_CONFIG.left,
          top: ROI_CONFIG.top,
          width: ROI_CONFIG.width,
          height: ROI_CONFIG.height,
          border: '2px solid #10b981',
          boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0.5)',
          borderRadius: '0px',
        }}
      />

      {/* ── Corner markers ── */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(' + ROI_CONFIG.left + ' - 2px)',
          top: 'calc(' + ROI_CONFIG.top + ' - 2px)',
          width: '16px',
          height: '16px',
          border: '3px solid #10b981',
          borderRight: 'none',
          borderBottom: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 'calc((100% - ' + ROI_CONFIG.left + ' - ' + ROI_CONFIG.width + ') - 2px)',
          top: 'calc(' + ROI_CONFIG.top + ' - 2px)',
          width: '16px',
          height: '16px',
          border: '3px solid #10b981',
          borderLeft: 'none',
          borderBottom: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 'calc(' + ROI_CONFIG.left + ' - 2px)',
          bottom: 'calc((100% - ' + ROI_CONFIG.top + ' - ' + ROI_CONFIG.height + ') - 2px)',
          width: '16px',
          height: '16px',
          border: '3px solid #10b981',
          borderRight: 'none',
          borderTop: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 'calc((100% - ' + ROI_CONFIG.left + ' - ' + ROI_CONFIG.width + ') - 2px)',
          bottom: 'calc((100% - ' + ROI_CONFIG.top + ' - ' + ROI_CONFIG.height + ') - 2px)',
          width: '16px',
          height: '16px',
          border: '3px solid #10b981',
          borderLeft: 'none',
          borderTop: 'none',
        }}
      />

      {/* ── Top Header ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
          color: '#fff',
          zIndex: 100,
        }}
      >
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Quét Barcode</div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </Box>
      </div>

      {/* ── Status Text (center) ── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '120px',
          textAlign: 'center',
          color: '#fff',
          fontSize: '12px',
          zIndex: 100,
        }}
      >
        {statusText}
      </div>

      {/* ── Bottom Controls ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
          zIndex: 100,
        }}
      >
        <Box style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleTorchToggle}
            style={{
              flex: 1,
              padding: '10px',
              background: torch ? '#3b82f6' : 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {torch ? '💡 Tắt' : '💡 Bật'}
          </button>
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Đóng
          </button>
        </Box>
      </div>

      {/* ── Hidden ROI Canvas ── */}
      <canvas ref={roiCanvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default ScanBarcodeFullScreen;
