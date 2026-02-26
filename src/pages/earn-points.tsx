// ===== Screen 2: Earn Points — v2 (Barcode Scan + Customer Info) =====
// • Auto-fill customer info when logged in as CUSTOMER
// • Camera zoom slider support
// • Refreshed UI/UX

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Page, Spinner, Icon } from 'zmp-ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  dealerCodeAtom,
  dealerInfoAtom,
  lastActivationAtom,
  customerNameAtom,
  customerPhoneAtom,
  authUserAtom,
} from '@/store/app-store';
import { api } from '@/services/api-client';
import {
  startScan,
  stopScan,
  startCameraPreview,
  captureAndDecode,
  decodeFromImageFile,
  isValidBarcode,
  isValidPhone,
  setPreviewZoom,
  getZoomCapabilities,
  SCANNER_VERSION,
  type ScannerError,
} from '@/services/scanner-enhanced';
import type { ApiError } from '@/types';

function EarnPointsPage() {
  const navigate = useNavigate();
  const dealerCode = useAtomValue(dealerCodeAtom);
  const dealerInfo = useAtomValue(dealerInfoAtom);
  const authUser = useAtomValue(authUserAtom);
  const setLastActivation = useSetAtom(lastActivationAtom);
  const [customerName, setCustomerName] = useAtom(customerNameAtom);
  const [customerPhone, setCustomerPhone] = useAtom(customerPhoneAtom);

  // True when a customer is logged in — skip manual input
  const isLoggedInCustomer = authUser?.role === 'CUSTOMER';

  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Camera scan state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  // Zoom state for camera preview
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);

  // Auto-fill customer info from logged-in user
  useEffect(() => {
    if (isLoggedInCustomer && authUser) {
      const name = authUser.customer?.name || authUser.fullName || '';
      const phone = authUser.customer?.phone || authUser.phone || '';
      if (name && !customerName) setCustomerName(name);
      if (phone && !customerPhone) setCustomerPhone(phone);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedInCustomer]);

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

  // Validate barcode — just check if it matches 5 valid product codes
  const handleBarcodeCheck = (bc: string) => {
    if (!bc || !isValidBarcode(bc)) {
      setFieldErrors((prev) => ({ ...prev, barcode: 'Barcode không hợp lệ. Cần mã Natri Ion hoặc numeric 8-20 chữ số' }));
      return;
    }
    
    // Valid barcode format — allow proceed
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.barcode;
      return next;
    });
  };

  // ── Camera scanning ──
  const handleStartScan = () => {
    setShowCamera(true);
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setError(null);
    setZoomLevel(1);
    setZoomCaps(null);
    
    setTimeout(() => {
      if (!videoRef.current) {
        setError('Không thể khởi tạo camera.');
        setShowCamera(false);
        return;
      }

      // Start camera preview (không scan liên tục)
      const cleanup = startCameraPreview(
        videoRef.current,
        // onError  
        (errType: ScannerError, errMsg: string) => {
          setShowCamera(false);
          if (errType === 'PERMISSION_DENIED') {
            setError('Quyền camera bị từ chối. Vui lòng cấp quyền camera trong cài đặt.');
          } else if (errType === 'NO_CAMERA') {
            setError('Không tìm thấy camera trên thiết bị.');
          } else if (errType === 'HTTPS_REQUIRED') {
            setError('Cần HTTPS để sử dụng camera.');
          } else {
            setError(`Lỗi camera: ${errMsg}`);
          }
        }
      );

      cleanupRef.current = cleanup;

      // Check zoom support after camera is ready
      setTimeout(() => {
        const caps = getZoomCapabilities();
        setZoomCaps(caps);
      }, 800);
    }, 100);
  };

  const handleStopScan = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;  
    }
    stopScan();
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setShowCamera(false);
  };

  // Chụp ảnh từ camera preview
  const handleCapturePhoto = async () => {
    if (!videoRef.current) {
      setError('Không thể chụp ảnh từ camera.');
      return;
    }

    try {
      const result = await captureAndDecode(videoRef.current);
      setCapturedPhoto(result.imageData);
      
      // Nếu tìm thấy barcode ngay khi chụp, auto-fill
      if (result.barcode && isValidBarcode(result.barcode)) {
        setBarcode(result.barcode);
        handleBarcodeCheck(result.barcode);
        setShowCamera(false);
        setCapturedPhoto(null);
      }
    } catch (err) {
      console.error('Capture error:', err);
      setError('Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  // Quét barcode từ ảnh đã chụp hoặc upload
  const handleScanFromPhoto = async () => {
    if (capturedPhoto) {
      // Scan from camera-captured photo (already saved as base64)
      setScanningPhoto(true);
      try {
        // Convert base64 to File object for processing
        const response = await fetch(capturedPhoto);
        const blob = await response.blob();
        const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
        
        const result = await decodeFromImageFile(file);
        if (result.barcode && isValidBarcode(result.barcode)) {
          setBarcode(result.barcode);
          handleBarcodeCheck(result.barcode);
          setShowCamera(false);
          setCapturedPhoto(null);
        } else {
          setError('Không tìm thấy barcode hợp lệ trong ảnh. Vui lòng chụp lại.');
        }
      } catch (err) {
        console.error('Scan error:', err);
        setError('Không thể quét barcode từ ảnh. Vui lòng thử lại.');
      } finally {
        setScanningPhoto(false);
      }
    } else if (uploadedPhoto) {
      // Re-scan uploaded photo with more processing attempts
      setScanningPhoto(true);
      try {
        // Create an image element from the uploaded photo data
        const img = new Image();
        img.onload = async () => {
          try {
            // Try multiple canvas processing approaches
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              setError('Cannot create canvas context');
              setScanningPhoto(false);
              return;
            }

            // Try different sizes and processing
            const attempts = [
              { scale: 1, enhance: false },
              { scale: 0.8, enhance: false },
              { scale: 1, enhance: true },
              { scale: 0.6, enhance: true },
            ];

            let found = false;
            for (const attempt of attempts) {
              if (found) break;
              
              canvas.width = Math.floor(img.width * attempt.scale);
              canvas.height = Math.floor(img.height * attempt.scale);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              if (attempt.enhance) {
                // Enhance contrast
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                  const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                  const enhanced = gray > 128 ? 255 : 0;
                  data[i] = data[i + 1] = data[i + 2] = enhanced;
                }
                ctx.putImageData(imageData, 0, 0);
              }

              try {
                const reader = new (await import('@zxing/browser')).BrowserMultiFormatReader();
                const result = await reader.decodeFromCanvas(canvas);
                if (result) {
                  const scannedCode = result.getText()?.trim()?.toUpperCase();
                  if (scannedCode && isValidBarcode(scannedCode)) {
                    setBarcode(scannedCode);
                    handleBarcodeCheck(scannedCode);
                    setUploadedPhoto(null);
                    found = true;
                    break;
                  }
                }
              } catch {
                // Continue to next attempt
              }
            }

            if (!found) {
              setError('Không tìm thấy barcode hợp lệ. Vui lòng thử ảnh khác có barcode rõ nét hơn.');
            }
          } catch (err) {
            console.error('Re-scan error:', err);
            setError('Lỗi khi quét lại ảnh. Vui lòng thử ảnh khác.');
          } finally {
            setScanningPhoto(false);
          }
        };
        img.onerror = () => {
          setError('Lỗi khi tải ảnh. Vui lòng thử lại.');
          setScanningPhoto(false);
        };
        img.src = uploadedPhoto;
      } catch (err) {
        console.error('Upload scan error:', err);
        setError('Lỗi khi quét ảnh upload. Vui lòng thử lại.');
        setScanningPhoto(false);
      }
    } else {
      setError('Không có ảnh để quét. Vui lòng chụp hoặc upload ảnh trước.');
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
    setError(null);
    
    console.log('Starting barcode detection for file:', file.name, file.size, 'bytes');

    try {
      const result = await decodeFromImageFile(file);
      setUploadedPhoto(result.imageData);
      
      console.log('Detection result:', {
        barcode: result.barcode,
        isValid: result.barcode ? isValidBarcode(result.barcode) : false,
        debugInfo: result.debugInfo
      });
      
      // Nếu tìm thấy barcode ngay lập tức
      if (result.barcode && isValidBarcode(result.barcode)) {
        setBarcode(result.barcode);
        handleBarcodeCheck(result.barcode);
        setUploadedPhoto(null); // Clear after successful scan
      } else {
        // Hiển thị ảnh và debug info để user xem
        const debugMsg = result.debugInfo ? ` [Debug: ${result.debugInfo}]` : '';
        if (result.barcode && !isValidBarcode(result.barcode)) {
          setError(
            `Tìm thấy barcode "${result.barcode}" nhưng không hợp lệ. ` +
            'Cần barcode của Natri Ion battery (12N5L, 12N7L, YTX4A, YTX5A, YTX7A) hoặc numeric 8-20 chữ số.' +
            debugMsg
          );
        } else {
          setError(
            'Không tìm thấy barcode trong ảnh. Hãy thử ảnh có barcode rõ nét hơn hoặc chụp lại.' +
            debugMsg
          );
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError((err as Error).message || 'Không thể xử lý ảnh. Vui lòng chọn ảnh khác.');
    } finally {
      setProcessingUpload(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleScan = handleStartScan;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!barcode.trim()) errors.barcode = 'Vui lòng nhập barcode';
    else if (!isValidBarcode(barcode)) errors.barcode = 'Barcode không hợp lệ. Cần mã Natri Ion (12N5L, 12N7L, YTX4A, YTX5A, YTX7A) hoặc numeric 8-20 chữ số';

    // Skip customer validation if already logged in as CUSTOMER
    if (!isLoggedInCustomer) {
      if (!customerName.trim() || customerName.trim().length < 2) errors.name = 'Tên ít nhất 2 ký tự';
      if (!isValidPhone(customerPhone)) errors.phone = 'SĐT không hợp lệ (VD: 0901234567)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.createActivation({
        barcode: barcode.trim(),
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        dealerCode: dealerCode || undefined,
      });
      setLastActivation(result);
      navigate('/result');
    } catch (err) {
      const apiErr = err as ApiError;
      console.error('Activation error:', apiErr);
      
      if (apiErr.statusCode === 409) {
        setError('✅ Barcode đã được tích điểm trước đó!');
      } else if (apiErr.statusCode === 404) {
        setError('❌ Không tìm thấy: ' + (apiErr.message || 'Dealer không tồn tại'));
      } else if (apiErr.statusCode === 400) {
        setError('❌ ' + (apiErr.message || 'Dữ liệu không hợp lệ'));
      } else {
        setError('❌ Lỗi: ' + (apiErr.message || 'Lỗi hệ thống, vui lòng thử lại'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #f0fdf4 60%, #fafafa 100%)' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">

        {/* ── Hero header ── */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          >
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Tích điểm sản phẩm</h1>
          {dealerInfo && (
            <p className="text-xs text-gray-500">
              Đại lý:{' '}
              <span className="font-semibold text-blue-600">
                {dealerInfo.shopName} ({dealerInfo.code})
              </span>
            </p>
          )}
        </div>

        {/* ── Barcode section ── */}
        <div
          className="rounded-2xl bg-white p-4 space-y-3"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="text-base">🔖</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm">Barcode sản phẩm</span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Nhập hoặc quét barcode…"
                value={barcode}
                maxLength={40}
                onChange={(e) => {
                  const val = e.target.value.trim().toUpperCase();
                  setBarcode(val);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.barcode;
                    return next;
                  });
                }}
                onBlur={() => handleBarcodeCheck(barcode)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            {/* Camera */}
            <button
              onClick={handleScan}
              disabled={showCamera || processingUpload}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all"
              style={{
                background: (showCamera || processingUpload)
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                boxShadow: (showCamera || processingUpload) ? 'none' : '0 4px 10px rgba(37,99,235,0.3)',
              }}
              title="Chụp ảnh barcode"
            >
              <Icon icon="zi-camera" />
            </button>
            {/* Upload */}
            <button
              onClick={handleUploadImage}
              disabled={showCamera || processingUpload}
              className="w-11 h-11 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all"
              title="Upload ảnh barcode"
            >
              {processingUpload ? <Spinner /> : <Icon icon="zi-photo" />}
            </button>
          </div>

          {fieldErrors.barcode && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <span>⚠️</span> {fieldErrors.barcode}
            </p>
          )}

          {/* Show checkmark when barcode is valid */}
          {barcode && !fieldErrors.barcode && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
              <span className="text-green-500 text-base">✅</span>
              <p className="text-xs text-green-700 font-medium">Barcode hợp lệ - sẵn sàng tích điểm</p>
            </div>
          )}
        </div>

        {/* ── Customer info section ── */}
        <div
          className="rounded-2xl bg-white p-4 space-y-3"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="text-base">👤</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm">Thông tin khách hàng</span>
          </div>

          {/* Customer info always editable, but pre-filled when logged in */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Họ và tên
                {isLoggedInCustomer && <span className="text-blue-500 ml-1">✓</span>}
              </label>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={customerName}
                maxLength={100}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.name;
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Số điện thoại
                {isLoggedInCustomer && <span className="text-blue-500 ml-1">✓</span>}
              </label>
              <input
                type="tel"
                placeholder="0901234567"
                value={customerPhone}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setCustomerPhone(val);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.phone;
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {fieldErrors.phone && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors.phone}
                </p>
              )}
            </div>

            {isLoggedInCustomer && (
              <p className="text-xs text-blue-500 flex items-center gap-1">
                <span>ℹ️</span> Thông tin từ tài khoản đã đăng nhập. Bạn có thể thay đổi nếu cần
              </p>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-2">
            <span className="text-red-400 flex-shrink-0">⚠️</span>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ── Submit button ── */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
          style={{
            background: loading
              ? '#93c5fd'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
            boxShadow: loading ? 'none' : '0 6px 20px rgba(37,99,235,0.4)',
          }}
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Spinner /> Đang xử lý…</span>
            : '⚡ Xác nhận tích điểm'
          }
        </button>

        {/* ── Back link ── */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </div>

      {/* ── Camera Modal (centered) ── */}
      {showCamera && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.90)' }}
        >
          <div
            className="bg-white rounded-3xl w-full"
            style={{ maxWidth: 520, maxHeight: '90vh', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
          >
            {/* No handle bar needed for centered modal */}
            <div className="flex justify-end pt-2 px-4">
              <button
                onClick={handleStopScan}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              {/* Title row */}
              <div className="text-center">
                <span className="font-bold text-gray-800 text-xl">
                  {(capturedPhoto || uploadedPhoto) ? '🔍 Xem lại ảnh' : '📷 Chụp barcode'}
                </span>
              </div>

              {/* Camera / photo view - LARGER & CENTERED */}
              <div
                className="relative rounded-2xl overflow-hidden bg-black mx-auto"
                style={{ aspectRatio: '3/4', maxWidth: '100%', width: '100%' }}
              >
                {(capturedPhoto || uploadedPhoto) ? (
                  <img
                    src={capturedPhoto || uploadedPhoto || ''}
                    alt="Barcode preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Animated scan-frame overlay - ADJUSTED FOR PORTRAIT */}
                    <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                      <div className="relative" style={{ width: '80%', height: '50%' }}>
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                        <div
                          className="absolute left-2 right-2 h-1 bg-green-400 rounded-full"
                          style={{
                            animation: 'scanLine 1.8s ease-in-out infinite',
                            boxShadow: '0 0 12px 3px rgba(74,222,128,0.8)',
                          }}
                        />
                      </div>
                    </div>
                    {/* Vignette */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'radial-gradient(ellipse 80% 50% at center, transparent 85%, rgba(0,0,0,0.6) 100%)',
                        pointerEvents: 'none',
                      }}
                    />
                  </>
                )}
              </div>

              {/* Zoom slider — only when live preview and zoom supported */}
              {!capturedPhoto && !uploadedPhoto && zoomCaps && (
                <div className="space-y-2 px-2 py-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold">🔭 Zoom</span>
                    <span className="font-bold text-blue-600">{zoomLevel.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min={zoomCaps.min}
                    max={zoomCaps.max}
                    step={zoomCaps.step || 0.1}
                    value={zoomLevel}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setZoomLevel(val);
                      setPreviewZoom(val);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#3b82f6' }}
                  />
                </div>
              )}

              {/* Action buttons */}
              {(capturedPhoto || uploadedPhoto) ? (
                <div className="space-y-3">
                  <p className="text-center text-xs text-gray-600 font-medium">
                    {capturedPhoto ? '✅ Ảnh đã chụp' : '📷 Ảnh đã tải lên'} · Chọn hành động tiếp theo
                  </p>
                  <div className="flex gap-2 justify-center">
                    {capturedPhoto ? (
                      <button
                        onClick={() => {
                          setCapturedPhoto(null);
                          setTimeout(() => {
                            if (videoRef.current) {
                              const cleanup = startCameraPreview(videoRef.current, (errType, errMsg) => {
                                setShowCamera(false);
                                setError(`Lỗi camera: ${errMsg}`);
                              });
                              cleanupRef.current = cleanup;
                            }
                          }, 100);
                        }}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        📷 Chụp lại
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleUploadImage}
                          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          🖼 Ảnh khác
                        </button>
                        <button
                          onClick={() => {
                            setUploadedPhoto(null);
                            setTimeout(() => {
                              if (videoRef.current) {
                                const cleanup = startCameraPreview(videoRef.current, (errType, errMsg) => {
                                  setShowCamera(false);
                                  setError(`Lỗi camera: ${errMsg}`);
                                });
                                cleanupRef.current = cleanup;
                              }
                            }, 100);
                          }}
                          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          📷 Chụp mới
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleScanFromPhoto}
                      disabled={scanningPhoto}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2"
                      style={{
                        background: scanningPhoto
                          ? '#93c5fd'
                          : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        boxShadow: scanningPhoto ? 'none' : '0 4px 12px rgba(37,99,235,0.35)',
                      }}
                    >
                      {scanningPhoto ? <Spinner /> : <>🔍 Quét</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">
                    📸 Đưa barcode vào khung xanh rồi nhấn <span className="text-green-600">Chụp</span>
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleStopScan}
                      className="px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      ✕ Hủy
                    </button>
                    <button
                      onClick={handleUploadImage}
                      className="px-4 py-3 rounded-xl text-sm font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Icon icon="zi-photo" /> <span>Ảnh</span>
                    </button>
                    <button
                      onClick={handleCapturePhoto}
                      className="px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all active:scale-95 hover:shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
                      }}
                    >
                      <Icon icon="zi-camera" /><span>📷 Chụp</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scan line animation */}
          <style>{`
            @keyframes scanLine {
              0%   { top: 8%;  opacity: 0.8; }
              50%  { top: 88%; opacity: 1;   }
              100% { top: 8%;  opacity: 0.8; }
            }
          `}</style>
        </div>
      )}

    </Page>
  );
}

export default EarnPointsPage;
