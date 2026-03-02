// ===== Barcode Management: Camera-only scan, NO manual input =====

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Text, Page, Spinner, Select } from 'zmp-ui';
import { useAtomValue } from 'jotai';
import { authUserAtom, accessTokenAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import {
  startScan,
  stopScan,
  startCameraPreview,
  captureAndDecode,
  decodeFromImageFile,
  decodeFromCroppedPhoto,
  isValidBarcode,
  parseBarcodePrefix,
  toggleTorch,
  getTorchState,
  SCANNER_VERSION,
  type ScannerError,
} from '@/services/scanner-enhanced';
import type { ApiError, BarcodeItemInfo } from '@/types';

const { Option } = Select;

// ── DEPRECATED: Using DOM-based crop calculation instead ──
// const ZOOM_LEVEL = 3; // Fixed 3x zoom for barcode capture

type ScanState =
  | 'idle'           // Chưa bắt đầu quét
  | 'previewing'     // Camera preview, chưa chụp ảnh
  | 'captured'       // Đã chụp ảnh, chờ scan hoặc chụp lại
  | 'scanning'       // Camera đang mở, đang quét (continuous mode)
  | 'scanned'        // Đã quét được, hiển thị kết quả
  | 'saving'         // Đang gửi lên backend
  | 'saved'          // Lưu thành công
  | 'error';         // Lỗi (camera / API / format)

// ── Helper: Calculate intersection of 2 DOMRects ──
function getIntersectionRect(a: DOMRect, b: DOMRect): DOMRect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  
  if (left >= right || top >= bottom) return null;
  
  return new DOMRect(left, top, right - left, bottom - top);
}

// ── Helper: Compute source crop rect from DOM elements (accounting for scale/transform) ──
function computeSourceCropRectFromDom(
  videoElement: HTMLVideoElement,
  cropFrameElement: HTMLElement | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!cropFrameElement) return null;
  
  const videoRect = videoElement.getBoundingClientRect();
  const frameRect = cropFrameElement.getBoundingClientRect();
  
  // Find intersection
  const intersectionRect = getIntersectionRect(videoRect, frameRect);
  if (!intersectionRect) {
    console.warn('[Crop] No intersection between video and frame');
    return null;
  }
  
  // Map UI pixels to video source pixels
  const scaleX = videoElement.videoWidth / videoRect.width;
  const scaleY = videoElement.videoHeight / videoRect.height;
  
  const sx = Math.max(0, Math.floor((intersectionRect.left - videoRect.left) * scaleX));
  const sy = Math.max(0, Math.floor((intersectionRect.top - videoRect.top) * scaleY));
  let sw = Math.floor(intersectionRect.width * scaleX);
  let sh = Math.floor(intersectionRect.height * scaleY);
  
  // Clamp to video bounds
  sw = Math.min(sw, videoElement.videoWidth - sx);
  sh = Math.min(sh, videoElement.videoHeight - sy);
  
  console.log(`[Crop] 📊 UI rect: ${videoRect.width}x${videoRect.height}, frame: ${frameRect.width}x${frameRect.height}`);
  console.log(`[Crop] 🎯 Source crop: x=${sx}, y=${sy}, w=${sw}, h=${sh}`);
  
  return { x: sx, y: sy, width: sw, height: sh };
}

function BarcodeManagePage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  // Scan state
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null); // ⭐ SINGLE image: crop region only
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [focusLocked, setFocusLocked] = useState(false);
  const [torchOn, setTorchOn] = useState(false);  // ⭐ Torch toggle state
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [inferredProduct, setInferredProduct] = useState<{ sku: string; productName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState<ScannerError | 'API' | 'INVALID_FORMAT' | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null); // ⭐ For DOM-based crop calculation
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Recent list state
  const [recentBarcodes, setRecentBarcodes] = useState<BarcodeItemInfo[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'' | 'UNUSED' | 'USED'>('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Redirect if not staff/admin
  useEffect(() => {
    if (!authUser || !['STAFF', 'ADMIN'].includes(authUser.role)) {
      navigate('/login');
    }
  }, [authUser, navigate]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      stopScan();
    };
  }, []);

  // Fetch recent barcodes
  const fetchBarcodes = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const result = await api.getBarcodes({
        status: filterStatus || undefined,
        skip: page * pageSize,
        take: pageSize,
      });
      setRecentBarcodes(result.data);
      setListTotal(result.total);
    } catch (err) {
      console.error('Failed to load barcodes:', err);
    } finally {
      setListLoading(false);
    }
  }, [token, filterStatus, page]);

  useEffect(() => {
    fetchBarcodes();
  }, [fetchBarcodes]);

  // ── Start camera scanning ──
  const handleStartScan = () => {
    setScannedBarcode('');
    setInferredProduct(null);
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setErrorMessage('');
    setErrorType(null);
    setSuccessMessage('');
    setScanState('previewing');
    setFocusLocked(false);

    // Wait for video element to render
    setTimeout(() => {
      if (!videoRef.current) {
        setScanState('error');
        setErrorType('UNKNOWN');
        setErrorMessage('Không thể khởi tạo video element.');
        return;
      }

      // Start camera preview
      const cleanup = startCameraPreview(
        videoRef.current,
        (errType, errMsg) => {
          setScanState('error');
          setErrorType(errType);
          setErrorMessage(errMsg);
        }
      );

      cleanupRef.current = cleanup;

      // Wait ~2 seconds AFTER startCameraPreview completes (which includes 700ms settle time)
      // This gives focus/exposure final stabilization before enabling capture
      setTimeout(() => {
        setFocusLocked(true);
        console.log('[Scan] Camera ready for capture (focus settled)');
      }, 2000);
    }, 100);
  };

  // ── Stop camera ──
  const handleStopScan = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    stopScan();
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setFocusLocked(false); // ⭐ Reset focus lock
    setTorchOn(false);     // ⭐ Reset torch toggle
    setScanState('idle');
  };

  // ── Quét lại ──
  const handleRescan = () => {
    handleStopScan();
    setTimeout(() => handleStartScan(), 200);
  };

  // ── Torch toggle: Manual control, not auto-on ──
  const handleTorchToggle = async () => {
    const newState = !torchOn;
    const success = await toggleTorch(newState);
    if (success) {
      setTorchOn(newState);
      console.log(`[Torch] Toggle success: ${newState ? 'ON ✔' : 'OFF ✘'}`);
    } else {
      console.warn('[Torch] Toggle failed - device may not support flashlight');
    }
  };

  // ── TASK D: Capture photo - full resolution, no blur ──
  const handleCapturePhoto = async () => {
    if (!videoRef.current) {
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage('Không thể chụp ảnh từ camera.');
      return;
    }

    try {
      const video = videoRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      
      console.log(`[Capture] 📹 Video source: ${vw}×${vh}`);
      const capLong = Math.max(vw, vh);
      const capOk = capLong >= 1280;
      console.log(`[Capture] LongSide: ${capLong}, OK: ${capOk}`);
      
      // Log track settings if available
      try {
        const track = video.srcObject instanceof MediaStream ? 
          video.srcObject.getVideoTracks()[0] : null;
        if (track) {
          const settings = track.getSettings();
          const tLong = Math.max(settings.width || 0, settings.height || 0);
          console.log(`[Capture] track.getSettings():`, settings);
          console.log(`[Capture] Track LongSide: ${tLong}, OK: ${tLong >= 1280}`);
        }
      } catch (e) {
        console.log('[Capture] Could not get track settings:', e);
      }
      
      // Step 1: Capture FULL video frame at native resolution (no upscale, no blur)
      const fullCanvas = document.createElement('canvas');
      const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
      if (!fullCtx) throw new Error('Cannot create full canvas context');
      
      fullCanvas.width = vw;
      fullCanvas.height = vh;
      fullCtx.imageSmoothingEnabled = false;  // CRITICAL: TẮT SMOOTHING
      fullCtx.imageSmoothingQuality = 'low';
      fullCtx.filter = 'none';
      fullCtx.globalCompositeOperation = 'source-over';
      fullCtx.drawImage(video, 0, 0, vw, vh);
      console.log(`[Capture] Full canvas: ${fullCanvas.width}×${fullCanvas.height} (imageSmoothingEnabled=${fullCtx.imageSmoothingEnabled}`);
      
      // Step 2: Crop from full frame (no scaling, exact crop region)
      const sourceCrop = computeSourceCropRectFromDom(video, cropFrameRef.current);
      if (!sourceCrop) {
        throw new Error('Cannot compute crop rect from DOM');
      }
      
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
      if (!cropCtx) throw new Error('Cannot create crop canvas context');
      
      const cropW = Math.round(sourceCrop.width);
      const cropH = Math.round(sourceCrop.height);
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      cropCtx.imageSmoothingEnabled = false;  // TẮT HẾT SMOOTHING
      cropCtx.imageSmoothingQuality = 'low';
      cropCtx.filter = 'none';
      cropCtx.globalCompositeOperation = 'source-over';
      
      // TASK C: Copy từ fullCanvas (exact 1:1, NO resize/blur)
      // sourceCrop đã là pixel tuyệt đối từ video source
      cropCtx.drawImage(
        fullCanvas,
        sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height,
        0, 0, cropW, cropH
      );
      
      console.log(`[Capture] Step 2: Cropped from full`);
      console.log(`[Capture] Source crop: x=${sourceCrop.x}, y=${sourceCrop.y}, w=${sourceCrop.width}, h=${sourceCrop.height}`);
      console.log(`[Capture] Output crop canvas: ${cropW}×${cropH}`);
      console.log(`[Capture] Crop width >= 600px: ${cropW >= 600}`);
      
      // TASK D: Convert to JPEG blob for better quality than dataURL
      cropCanvas.toBlob(
        (blob) => {
          try {
            if (!blob) {
              throw new Error('toBlob returned null');
            }
            const blobUrl = URL.createObjectURL(blob);
            setCapturedPhoto(blobUrl);
            setScanState('captured');
            console.log(`[Capture] ✅ Blob URL: ${blobUrl.substring(0, 50)}...`);
            console.log(`[Capture] ✅ Captured ${cropW}×${cropH} crop (no smoothing, exact copy from full frame)`);
          } catch (err) {
            console.error('toBlob error:', err);
            setScanState('error');
            setErrorType('UNKNOWN');
            setErrorMessage('Lỗi khi xử lý ảnh. Vui lòng thử lại.');
          }
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      console.error('Capture error:', err);
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage('Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  // ── TASK E: Quét chỉ từ ảnh crop (không recapture) ──
  const handleScanFromPhoto = async () => {
    if (capturedPhoto) {
      setScanningPhoto(true);
      try {
        console.log(`[Decode] 🔍 Decoding from captured cropped photo (blob URL)`);
        
        const result = await decodeFromCroppedPhoto(capturedPhoto);
        
        if (result.barcode && isValidBarcode(result.barcode)) {
          console.log(`[Decode] ✅ SUCCESS: ${result.barcode}`);
          setScannedBarcode(result.barcode);
          const parsed = parseBarcodePrefix(result.barcode);
          setInferredProduct(parsed);
          setScanState('scanned');
        } else {
          console.log(`[Decode] ❌ No valid barcode found`);
          setScanState('error');
          setErrorType('INVALID_FORMAT');
          setErrorMessage('Không tìm thấy barcode hợp lệ trong ảnh. Phải bắt đầu bằng 12N5L, 12N7L, YTX4A, YTX5A hoặc YTX7A.');
        }
      } catch (err) {
        console.error('Scan error:', err);
        setScanState('error');
        setErrorType('UNKNOWN');
        setErrorMessage('Không thể quét barcode từ ảnh. Vui lòng chụp lại.');
      } finally {
        setScanningPhoto(false);
      }
    } else if (uploadedPhoto) {
      setScanningPhoto(true);
      console.log('[Decode] Re-scanning uploaded photo using decodeFromImageFile');
      (async () => {
        try {
          const blob = await (await fetch(uploadedPhoto)).blob();
          const file = new File([blob], 'uploaded.jpg', { type: 'image/jpeg' });
          const result = await decodeFromImageFile(file);
          
          if (result.barcode && isValidBarcode(result.barcode)) {
            console.log('[Decode] SUCCESS:', result.barcode);
            setScannedBarcode(result.barcode);
            const parsed = parseBarcodePrefix(result.barcode);
            setInferredProduct(parsed);
            setScanState('scanned');
          } else {
            setScanState('error');
            setErrorType('INVALID_FORMAT');
            setErrorMessage(result.barcode ? 'Invalid prefix' : 'No barcode detected');
          }
        } catch (err) {
          console.error('Upload scan error:', err);
          setScanState('error');
          setErrorType('UNKNOWN');
          setErrorMessage('Lỗi quét ảnh upload');
        } finally {
          setScanningPhoto(false);
        }
      })();
    } else {
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage('Không có ảnh để quét. Vui lòng chụp hoặc upload ảnh trước.');
    }
  };

  // Upload và quét barcode từ ảnh
  const handleUploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingUpload(true);
    setScanState('captured');
    setErrorMessage('');
    setErrorType(null);
    
    console.log('Starting advanced barcode detection for:', file.name, file.size, 'bytes');

    try {
      const result = await decodeFromImageFile(file);
      setUploadedPhoto(result.imageData);
      
      console.log('Advanced detection result:', {
        barcode: result.barcode,
        isValid: result.barcode ? isValidBarcode(result.barcode) : false,
        debugInfo: result.debugInfo
      });
      
      // Nếu tìm thấy barcode ngay lập tức
      if (result.barcode && isValidBarcode(result.barcode)) {
        setScannedBarcode(result.barcode);
        const parsed = parseBarcodePrefix(result.barcode);
        setInferredProduct(parsed);
        setScanState('scanned');
      } else {
        // Hiển thị ảnh và debug info để user xem
        setScanState('error');
        setErrorType('INVALID_FORMAT');
        const debugMsg = result.debugInfo ? ` [Debug: ${result.debugInfo}]` : '';
        
        if (result.barcode && !isValidBarcode(result.barcode)) {
          setErrorMessage(
            `Tìm thấy barcode "${result.barcode}" nhưng không phải của Natri Ion battery. ` +
            'Cần prefix 12N5L, 12N7L, YTX4A, YTX5A hoặc YTX7A.' +
            debugMsg
          );
        } else {
          setErrorMessage(
            'Không tìm thấy barcode trong ảnh. Hãy thử ảnh có barcode rõ nét hơn.' +
            debugMsg
          );
        }
      }
    } catch (err) {
      console.error('Advanced upload error:', err);
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage((err as Error).message || 'Không thể xử lý ảnh. Vui lòng chọn ảnh khác.');
    } finally {
      setProcessingUpload(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ── Xác nhận lưu barcode ──
  const handleSave = async () => {
    if (!scannedBarcode || !inferredProduct) return;

    setScanState('saving');
    setErrorMessage('');

    try {
      await api.scanAddBarcode({ code: scannedBarcode });
      setScanState('saved');
      setSuccessMessage(
        `Đã lưu barcode ${scannedBarcode} → ${inferredProduct.productName}`,
      );
      // Refresh list
      fetchBarcodes();
    } catch (err) {
      const apiErr = err as ApiError;
      setScanState('error');
      setErrorType('API');

      if (apiErr.statusCode === 409) {
        setErrorMessage(`Barcode "${scannedBarcode}" đã tồn tại trong hệ thống!`);
      } else if (apiErr.statusCode === 403) {
        setErrorMessage('Bạn không có quyền thêm barcode.');
      } else if (apiErr.statusCode === 400) {
        setErrorMessage(apiErr.message || 'Barcode không hợp lệ.');
      } else {
        setErrorMessage(apiErr.message || 'Lỗi hệ thống, vui lòng thử lại.');
      }
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()} ${d
      .getHours()
      .toString()
      .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const totalPages = Math.ceil(listTotal / pageSize);

  if (!authUser) return null;

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-5">
        {/* Header */}
        <Box textAlign="center" className="pt-4 pb-2">
          <Text.Title size="large" className="text-blue-600">
            Quản lý Barcode
          </Text.Title>
          <Text size="xSmall" className="text-gray-400 mt-1">
            Quét bằng camera để thêm barcode
          </Text>
          <Text size="xSmall" className="text-gray-300 mt-1">
            Scanner v{SCANNER_VERSION}
          </Text>
        </Box>

        {/* ─ Scan section ─ */}
        <Box className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3">
          <Text size="small" bold className="text-blue-700 mb-2">
            Quét Barcode
          </Text>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* === IDLE state === */}
          {scanState === 'idle' && (
            <Box className="flex gap-2">
              <Button variant="primary" onClick={handleStartScan} className="flex-1">
                📷 Bắt đầu quét
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleUploadImage}
                loading={processingUpload}
                disabled={processingUpload}
                className="flex-1"
              >
                {processingUpload ? <Spinner /> : '🖼️ Upload ảnh'}
              </Button>
            </Box>
          )}

          {/* === PREVIEWING state — camera preview === */}
          {scanState === 'previewing' && (
            <Box className="space-y-3">
              <Box className="relative overflow-hidden bg-black" style={{ 
                minHeight: 420, 
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  disablePictureInPicture
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',                    // Show full frame without cropping
                    objectPosition: 'center',
                    backgroundColor: '#000',
                    WebkitBackfaceVisibility: 'hidden' as any,
                    backfaceVisibility: 'hidden' as any,
                    WebkitFontSmoothing: 'antialiased' as any,
                    textRendering: 'geometricPrecision' as any,
                  }}
                />
                
                {/* Crop frame overlay guide */}
                <div
                  ref={cropFrameRef}
                  className="absolute border-2 border-green-400"
                  style={{
                    left: '15%',
                    top: '25%',
                    width: '70%',
                    height: '50%',
                    boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0.5)',
                    borderRadius: '0px',
                    backfaceVisibility: 'hidden',
                  }}
                />
                
                {/* Corner markers */}
                <div
                  className="absolute"
                  style={{
                    left: '15%',
                    top: '25%',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #10b981',
                    borderRight: 'none',
                    borderBottom: 'none',
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    right: '15%',
                    top: '25%',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #10b981',
                    borderLeft: 'none',
                    borderBottom: 'none',
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    left: '15%',
                    bottom: '25%',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #10b981',
                    borderRight: 'none',
                    borderTop: 'none',
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    right: '15%',
                    bottom: '25%',
                    width: '20px',
                    height: '20px',
                    border: '3px solid #10b981',
                    borderLeft: 'none',
                    borderTop: 'none',
                  }}
                />
              </Box>
              <Text size="xSmall" className="text-center text-gray-500">
                Đưa barcode vào khung xanh và chụp ảnh
              </Text>
              <Box className="flex gap-2">
                <Button variant="secondary" onClick={handleStopScan} className="flex-1">
                  ✕ Hủy
                </Button>
                <Button 
                  variant={torchOn ? 'primary' : 'secondary'}
                  onClick={handleTorchToggle}
                  className="flex-1"
                  title={torchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                >
                  {torchOn ? '💡 Tắt' : '💡 Bật'}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleCapturePhoto}
                  disabled={!focusLocked}
                  className="flex-1"
                  style={{ opacity: focusLocked ? 1 : 0.5 }}
                >
                  📷 {focusLocked ? 'Chụp' : 'Đợi focus...'}
                </Button>
              </Box>
            </Box>
          )}

          {/* === CAPTURED state — show captured image === */}
          {scanState === 'captured' && (capturedPhoto || uploadedPhoto) && (
            <Box className="space-y-3">
              <Box className="relative overflow-hidden bg-black" style={{ 
                minHeight: 280, 
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src={capturedPhoto || uploadedPhoto || ''}
                  alt={capturedPhoto ? "Captured barcode (cropped)" : "Uploaded barcode"}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    imageRendering: 'crisp-edges' as any, // Sharp edges for barcode lines
                    WebkitBackfaceVisibility: 'hidden' as any,
                    backfaceVisibility: 'hidden' as any,
                    textRendering: 'geometricPrecision' as any,
                  }}
                />
              </Box>
              <Text size="xSmall" className="text-center text-gray-600">
                {capturedPhoto ? '✨ Ảnh chụp sắc nét (full-res, no blur). Nhấn Quét hoặc thử lại.' : '✨ Ảnh tải lên.'}
              </Text>
              <Box className="flex gap-2">
                {capturedPhoto && !uploadedPhoto ? (
                  // Nếu là ảnh chụp, chỉ cho phép chụp lại
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      console.log('[Recapture] Restarting camera...');
                      // Cleanup old camera stream first
                      if (cleanupRef.current) {
                        cleanupRef.current();
                        cleanupRef.current = null;
                      }
                      setCapturedPhoto(null);
                      setFocusLocked(false);
                      setScanState('previewing');
                      
                      // Wait for video element, then restart camera
                      setTimeout(() => {
                        if (videoRef.current) {
                          const cleanup = startCameraPreview(
                            videoRef.current,
                            (errType, errMsg) => {
                              setScanState('error');
                              setErrorType(errType);
                              setErrorMessage(errMsg);
                            }
                          );
                          cleanupRef.current = cleanup;
                          
                          // Enable capture after focus/exposure settles (~2s from startCameraPreview)
                          setTimeout(() => {
                            setFocusLocked(true);
                            console.log('[Recapture] Ready for capture');
                          }, 2000);
                        } else {
                          console.error('[Recapture] Video element not ready');
                        }
                      }, 100);
                    }}
                    className="flex-1"
                  >
                    📷 Chụp lại
                  </Button>
                ) : (
                  // Nếu là ảnh upload, cho phép chọn ảnh khác hoặc chụp mới
                  <>
                    <Button 
                      variant="secondary" 
                      onClick={handleUploadImage}
                      className="flex-1"
                    >
                      🖼️ Chọn khác
                    </Button>
                    <Button 
                      variant="tertiary" 
                      onClick={() => {
                        console.log('[Capture] New capture (stream kept active)');
                        setUploadedPhoto(null);
                        setScanState('previewing');
                        
                        // Stream stays active - just reset UI
                        setTimeout(() => {
                          setFocusLocked(true);
                          console.log('[Capture] Ready for capture');
                        }, 300);
                      }}
                      className="flex-1"
                    >
                      📷 Chụp mới
                    </Button>
                  </>
                )}
                <Button 
                  variant="primary" 
                  onClick={handleScanFromPhoto}
                  loading={scanningPhoto}
                  disabled={scanningPhoto}
                  className="flex-1"
                >
                  {scanningPhoto ? <Spinner /> : '🔍 Quét'}
                </Button>
              </Box>
            </Box>
          )}

          {/* === SCANNED state — show result, confirm save === */}
          {scanState === 'scanned' && inferredProduct && (
            <Box className="space-y-3">
              {capturedPhoto && (
                <Box className="relative overflow-hidden bg-black" style={{ 
                  minHeight: 280, 
                  aspectRatio: '16/9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src={capturedPhoto}
                    alt="Barcode scanned"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      imageRendering: 'pixelated' as any,
                      WebkitBackfaceVisibility: 'hidden' as any,
                      backfaceVisibility: 'hidden' as any,
                      transform: 'scale(5) translateZ(0)',
                      transformOrigin: 'center',
                      WebkitAppearance: 'none' as any,
                      textRendering: 'geometricPrecision' as any,
                      filter: 'contrast(1.4) saturate(1.3) brightness(1.1) drop-shadow(0 0 0.5px rgba(0,0,0,0.3))' as any,
                    }}
                  />
                </Box>
              )}
              <Box className="bg-white rounded-lg p-3 border border-blue-300 space-y-2">
                <Text size="xSmall" className="text-gray-500">Barcode đã quét:</Text>
                <Text size="normal" bold className="text-blue-700 break-all">
                  {scannedBarcode}
                </Text>
                <Text size="xSmall" className="text-gray-500">Sản phẩm nhận diện:</Text>
                <Text size="small" bold className="text-green-700">
                  {inferredProduct.productName}
                </Text>
                <Text size="xSmall" className="text-gray-400">
                  SKU: {inferredProduct.sku}
                </Text>
              </Box>
              <Box className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSave}
                >
                  ✓ Xác nhận lưu
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleRescan}
                >
                  ↻ Quét lại
                </Button>
              </Box>
            </Box>
          )}

          {/* === SAVING state === */}
          {scanState === 'saving' && (
            <Box className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <Text size="small" className="text-blue-600">
                Đang lưu barcode...
              </Text>
            </Box>
          )}

          {/* === SAVED state === */}
          {scanState === 'saved' && (
            <Box className="space-y-3">
              <Box className="bg-green-50 rounded-lg p-3 border border-green-300">
                <Text size="small" className="text-green-700">
                  ✓ {successMessage}
                </Text>
              </Box>
              <Button variant="primary" fullWidth onClick={handleRescan}>
                📷 Quét barcode tiếp
              </Button>
            </Box>
          )}

          {/* === ERROR state === */}
          {scanState === 'error' && (
            <Box className="space-y-3">
              <Box className="bg-red-50 rounded-lg p-3 border border-red-300 space-y-1">
                <Text size="small" bold className="text-red-700">
                  {errorType === 'PERMISSION_DENIED' && '🔒 Quyền camera bị từ chối'}
                  {errorType === 'NO_CAMERA' && '📷 Không tìm thấy camera'}
                  {errorType === 'NOT_READABLE' && '⚠️ Camera không khả dụng'}
                  {errorType === 'HTTPS_REQUIRED' && '🔐 Yêu cầu HTTPS'}
                  {errorType === 'TIMEOUT' && '⏱ Hết thời gian quét'}
                  {errorType === 'INVALID_FORMAT' && '❌ Barcode không hợp lệ'}
                  {errorType === 'API' && '⚠️ Lỗi hệ thống'}
                  {errorType === 'UNKNOWN' && '⚠️ Lỗi không xác định'}
                </Text>
                <Text size="xSmall" className="text-red-600">
                  {errorMessage}
                </Text>
                {errorType === 'PERMISSION_DENIED' && (
                  <Text size="xSmall" className="text-gray-500 mt-2">
                    Hướng dẫn: Cài đặt → Ứng dụng → Zalo → Quyền → Bật Camera
                  </Text>
                )}
              </Box>
              <Button variant="primary" fullWidth onClick={handleRescan}>
                ↻ Quét lại
              </Button>
            </Box>
          )}
        </Box>

        {/* ─ Recent barcodes list ─ */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Danh sách Barcode ({listTotal})
          </Text>

          {/* Filter */}
          <Select
            value={filterStatus}
            onChange={(val) => {
              setFilterStatus(val as '' | 'UNUSED' | 'USED');
              setPage(0);
            }}
            placeholder="Trạng thái"
          >
            <Option value="" title="Tất cả" />
            <Option value="UNUSED" title="Chưa dùng" />
            <Option value="USED" title="Đã dùng" />
          </Select>

          {/* Loading */}
          {listLoading && (
            <Box className="flex justify-center py-4">
              <Spinner />
            </Box>
          )}

          {/* Empty */}
          {!listLoading && recentBarcodes.length === 0 && (
            <Box className="text-center py-4">
              <Text size="small" className="text-gray-400">
                Chưa có barcode nào
              </Text>
            </Box>
          )}

          {/* Barcode list */}
          {!listLoading &&
            recentBarcodes.map((item) => (
              <Box
                key={item.id}
                className="bg-gray-50 rounded-xl p-3 border space-y-1"
              >
                <Box className="flex justify-between items-start">
                  <Box className="flex-1">
                    <Text size="small" bold>
                      {item.barcode}
                    </Text>
                    <Text size="xSmall" className="text-gray-400">
                      {item.product.name} ({item.product.sku})
                    </Text>
                  </Box>
                  <Text
                    size="xSmall"
                    bold
                    className={
                      item.status === 'UNUSED'
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }
                  >
                    {item.status === 'UNUSED' ? 'Chưa dùng' : 'Đã dùng'}
                  </Text>
                </Box>
                <Box className="flex justify-between">
                  <Text size="xSmall" className="text-gray-500">
                    {item.createdBy
                      ? `Thêm bởi: ${item.createdBy.fullName || item.createdBy.username}`
                      : ''}
                  </Text>
                  <Text size="xSmall" className="text-gray-400">
                    {formatDate(item.createdAt)}
                  </Text>
                </Box>
              </Box>
            ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box className="flex justify-center gap-2 pt-2">
              <Button
                variant="tertiary"
                size="small"
                disabled={page <= 0}
                onClick={() => setPage(page - 1)}
              >
                ← Trước
              </Button>
              <Text size="xSmall" className="text-gray-500 self-center">
                {page + 1} / {totalPages}
              </Text>
              <Button
                variant="tertiary"
                size="small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Sau →
              </Button>
            </Box>
          )}
        </Box>

        {/* Back */}
        <Box className="space-y-2 pt-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              navigate(authUser?.role === 'ADMIN' ? '/admin-home' : '/staff-home')
            }
          >
            ← Quay lại
          </Button>
        </Box>
      </Box>

    </Page>
  );
}

export default BarcodeManagePage;
