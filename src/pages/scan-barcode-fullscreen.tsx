// ===== Full-Screen Barcode Scanner — Auto-Scan Realtime =====
// Fast auto-detect: persistent ZXing reader, 150ms loop, format hints

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box } from 'zmp-ui';
import { 
  isValidBarcode, 
  parseBarcodePrefix, 
} from '@/services/scanner-enhanced';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import type { Result } from '@zxing/library';

// ── Auto-scan state ──
type ScannerState = 'initializing' | 'scanning' | 'detected' | 'error' | 'closed';

interface ScanResult {
  barcode: string;
  productName?: string;
  sku?: string;
}

// ── Create ONE persistent ZXing reader with format hints (reused across scans) ──
function createZXingReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

interface ScanBarcodeFullScreenProps {
  onResult?: (result: ScanResult) => void;
}

function ScanBarcodeFullScreen(props: ScanBarcodeFullScreenProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedRef = useRef(false);
  // Persistent ZXing reader — created ONCE, reused every scan frame
  const readerRef = useRef<BrowserMultiFormatReader>(createZXingReader());

  const [state, setState] = useState<ScannerState>('initializing');
  const [torch, setTorch] = useState(false);
  const [statusText, setStatusText] = useState('Khởi tạo camera...');
  const [detectedBarcode, setDetectedBarcode] = useState('');
  const noDetectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setStatusText('Đang quét...');
      setState('scanning');
    } catch (err) {
      console.error('Camera error:', err);
      setStatusText('Lỗi camera. Vui lòng kiểm tra quyền.');
      setState('error');
    }
  }, []);

  // ── Auto-scan loop ──
  const startAutoScan = useCallback(() => {
    const SCAN_INTERVAL = 300; // ms — scan every 300ms
    let attemptCount = 0;
    const NO_DETECT_TIMEOUT = 6000; // 6 seconds before showing hint

    // Set timeout to show hint if no detection
    noDetectionTimeoutRef.current = setTimeout(() => {
      if (!detectedRef.current) {
        setStatusText(
          'Không tìm thấy barcode.\nHãy đưa camera gần hơn hoặc chỉnh lại góc.'
        );
        console.log('[Scan] No detection after 6s — showing hint, scan continues...');
      }
    }, NO_DETECT_TIMEOUT);

    const scanLoop = async () => {
      if (detectedRef.current || !videoRef.current) return;

      const video = videoRef.current;
      const canvas = roiCanvasRef.current;
      if (!canvas) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        if (attemptCount % 10 === 0) console.debug('[Scan] Video not ready yet');
        return;
      }

      // Draw full frame to canvas
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(video, 0, 0, vw, vh);

      attemptCount++;
      try {
        // Use persistent reader — no re-initialization overhead
        const result: Result = await readerRef.current.decodeFromCanvas(canvas);
        const rawText = result.getText().trim().toUpperCase();

        console.log(`[Scan] #${attemptCount} raw="${rawText}" format=${result.getBarcodeFormat()}`);

        if (isValidBarcode(rawText)) {
          console.log(`✅ BARCODE DETECTED: "${rawText}" (attempt #${attemptCount})`);

          // Clear timeout hint
          if (noDetectionTimeoutRef.current) {
            clearTimeout(noDetectionTimeoutRef.current);
            noDetectionTimeoutRef.current = null;
          }

          detectedRef.current = true;
          setDetectedBarcode(rawText);
          setState('detected');
          setStatusText(`Đã nhận barcode:\n${rawText}`);

          // Stop scan loop immediately
          if (scannerRef.current) {
            clearInterval(scannerRef.current);
            scannerRef.current = null;
          }

          // Haptic feedback
          if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);

          // Callback
          if (props.onResult) {
            const parsed = parseBarcodePrefix(rawText);
            props.onResult({ barcode: rawText, productName: parsed?.productName, sku: parsed?.sku });
          }

          // Store & navigate back
          setTimeout(() => {
            setStatusText('Đang xử lý...');
            setTimeout(() => {
              sessionStorage.setItem('scanResult', rawText);
              console.log(`[Scanner] Stored "${rawText}" in sessionStorage → navigating back`);
              window.history.back();
            }, 200);
          }, 300);
        } else {
          console.debug(`[Scan] #${attemptCount} not valid barcode: "${rawText}"`);
        }
      } catch {
        // ZXing throws NotFoundException when no barcode in frame — normal, continue
        if (attemptCount % 20 === 0) {
          console.debug(`[Scan] ${attemptCount} attempts, no barcode yet`);
        }
      }
    };

    // Show initial status
    setStatusText('Đang quét barcode...');

    // Run immediately, then every SCAN_INTERVAL ms
    scanLoop();
    scannerRef.current = setInterval(scanLoop, SCAN_INTERVAL);
  }, [props]);

  // ── Initialize camera on mount ──
  useEffect(() => {
    startCamera();

    return () => {
      // Cleanup
      if (scannerRef.current) clearInterval(scannerRef.current);
      if (noDetectionTimeoutRef.current) clearTimeout(noDetectionTimeoutRef.current);
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
    if (noDetectionTimeoutRef.current) clearTimeout(noDetectionTimeoutRef.current);
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
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
          display: 'block',
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
          fontSize: '13px',
          zIndex: 100,
          whiteSpace: 'pre-line',
          lineHeight: '1.4',
          fontWeight: '500',
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
