// ===== Screen 2: Earn Points — v2 (Barcode Scan + Customer Info) =====
// • Auto-fill customer info when logged in as CUSTOMER
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
  stopScan,
  startCameraPreview,
  startAutoScanFromStream,
  captureAndDecode,
  decodeFromImageFile,
  isValidBarcode,
  isValidPhone,
  SCANNER_VERSION,
  type ScannerError,
  setPreviewZoom,
  getZoomCapabilities,
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
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [autoScanDetected, setAutoScanDetected] = useState<string | null>(null);
  const [cssZoom, setCssZoom] = useState(false); // CSS zoom fallback when hardware zoom not supported
  const [buttonBusy, setButtonBusy] = useState(false); // Prevent double-click on buttons
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);
  const autoScanCleanupRef = React.useRef<(() => void) | null>(null);



  // Toast notification for scan feedback
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Error modal for critical scan failures
  const [errorModal, setErrorModal] = useState<{ title: string; message: string; action: string } | null>(null);

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

  // Toast auto-dismiss effect
  useEffect(() => {
    if (scanToast) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setScanToast(null);
      }, 4000);
    }
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [scanToast]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (autoScanCleanupRef.current) {
        autoScanCleanupRef.current();
        autoScanCleanupRef.current = null;
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

  // Helper: start auto-scan on the current video preview
  const startAutoScanOnPreview = () => {
    if (!autoScanEnabled || !videoRef.current) return;
    // Stop previous auto-scan if any
    if (autoScanCleanupRef.current) {
      autoScanCleanupRef.current();
      autoScanCleanupRef.current = null;
    }
    const scanCleanup = startAutoScanFromStream(
      videoRef.current,
      (detectedBarcode: string) => {
        setAutoScanDetected(detectedBarcode);
        setBarcode(detectedBarcode);
        handleBarcodeCheck(detectedBarcode);
        setScanToast({ type: 'success', message: '✅ Tìm thấy barcode qua auto-scan!' });
      },
      { intervalMs: 350 },
    );
    autoScanCleanupRef.current = scanCleanup;
  };

  // Helper: open camera preview + auto-scan + auto zoom
  const openCameraWithAutoScan = () => {
    if (!videoRef.current) {
      setError('Không thể khởi tạo camera.');
      setShowCamera(false);
      return;
    }

    setCssZoom(false); // reset CSS zoom

    // Clean up old stream/scan FIRST before starting new camera
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (autoScanCleanupRef.current) {
      autoScanCleanupRef.current();
      autoScanCleanupRef.current = null;
    }

    // Small delay to ensure cleanup completes
    setTimeout(() => {
      if (!videoRef.current) return;

      const cleanup = startCameraPreview(
        videoRef.current,
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

      // Wait for camera stream to be ready, then apply zoom + start auto-scan
      setTimeout(async () => {
        // Try hardware zoom x3 first
        const hwZoomOk = await setPreviewZoom(3.0);
        if (!hwZoomOk) {
          // Hardware zoom not supported — use CSS transform as visual zoom
          setCssZoom(true);
          console.log('[Scan] Using CSS zoom fallback (scale 2x)');
        }
        startAutoScanOnPreview();
      }, 700);
    }, 100);
  };

  // ── Camera scanning with auto-detection ──
  const handleStartScan = () => {
    if (buttonBusy) {
      console.log('[Scan] Button busy, ignoring click');
      return;
    }
    
    try {
      console.log('[Scan] Opening camera...');
      setButtonBusy(true);
      setShowCamera(true);
      setCapturedPhoto(null);
      setUploadedPhoto(null);
      setAutoScanDetected(null);
      setError(null);
      
      setTimeout(() => {
        openCameraWithAutoScan();
        // Release button after camera starts
        setTimeout(() => setButtonBusy(false), 1000);
      }, 100);
    } catch (err) {
      console.error('[Scan] Error opening camera:', err);
      setError('Không thể mở camera. Vui lòng thử lại.');
      setButtonBusy(false);
      setShowCamera(false);
    }
  };

  const handleStopScan = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;  
    }
    if (autoScanCleanupRef.current) {
      autoScanCleanupRef.current();
      autoScanCleanupRef.current = null;
    }
    stopScan();
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setShowCamera(false);
    setAutoScanDetected(null);
  };

  // Chụp ảnh từ camera preview
  const handleCapturePhoto = async () => {
    if (!videoRef.current) {
      setError('Không thể chụp ảnh từ camera.');
      return;
    }

    if (buttonBusy) {
      console.log('[Capture] Button busy, ignoring click');
      return;
    }

    try {
      console.log('[Capture] Taking photo...');
      setButtonBusy(true);
      
      const result = await captureAndDecode(videoRef.current);
      setCapturedPhoto(result.imageData);
      
      // Nếu tìm thấy barcode ngay khi chụp, auto-fill
      if (result.barcode && isValidBarcode(result.barcode)) {
        console.log('[Capture] Barcode detected:', result.barcode);
        setBarcode(result.barcode);
        handleBarcodeCheck(result.barcode);
        setShowCamera(false);
        setCapturedPhoto(null);
        setScanToast({ type: 'success', message: '✅ Đã nhận diện barcode từ ảnh!' });
      } else {
        console.log('[Capture] No barcode found in photo');
      }
    } catch (err) {
      console.error('[Capture] Capture error:', err);
      setError('Không thể chụp ảnh. Vui lòng thử lại.');
    } finally {
      setButtonBusy(false);
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
          setScanToast({ type: 'success', message: '✅ Tìm thấy barcode!' });
          setTimeout(() => {
            setShowCamera(false);
            setCapturedPhoto(null);
          }, 800);
        } else {
          setErrorModal({ 
            title: '❌ Không tìm thấy Barcode', 
            message: 'Ảnh chụp không chứa barcode rõ nét hoặc đọc được.\n\nVui lòng chụp lại với camera.',
            action: 'Chụp mới'
          });
        }
      } catch (err) {
        console.error('Scan error:', err);
        setErrorModal({ 
          title: '❌ Lỗi quét ảnh', 
          message: 'Đã xảy ra lỗi khi quét barcode từ ảnh.\n\nVui lòng chụp lại với camera.',
          action: 'Thử lại'
        });
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
              setScanToast({ type: 'error', message: '❌ Lỗi: Không thể xử lý ảnh' });
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
              setErrorModal({ 
                title: '❌ Không tìm thấy Barcode', 
                message: 'Ảnh tải lên không chứa barcode rõ nét hoặc đọc được.\n\nVui lòng chọn ảnh khác hoặc chụp mới từ camera.',
                action: 'Thử ảnh khác'
              });
            }
          } catch (err) {
            console.error('Re-scan error:', err);
            setErrorModal({ 
              title: '❌ Lỗi xử lý ảnh', 
              message: 'Đã xảy ra lỗi khi xử lý ảnh.\n\nVui lòng thử ảnh khác hoặc chụp mới.',
              action: 'Đóng'
            });
          } finally {
            setScanningPhoto(false);
          }
        };
        img.onerror = () => {
          setErrorModal({ 
            title: '❌ Lỗi tải ảnh', 
            message: 'Không thể tải ảnh đã chọn.\n\nVui lòng kiểm tra định dạng (JPG, PNG) và thử lại.',
            action: 'Đóng'
          });
          setScanningPhoto(false);
        };
        img.src = uploadedPhoto;
      } catch (err) {
        console.error('Upload scan error:', err);
        setErrorModal({ 
          title: '❌ Lỗi quét ảnh', 
          message: 'Không thể quét barcode từ ảnh đã tải lên.\n\nVui lòng thử ảnh khác hoặc chụp mới.',
          action: 'Đóng'
        });
        setScanningPhoto(false);
      }
    } else {
      setScanToast({ type: 'warning', message: '⚠️ Vui lòng chụp hoặc upload ảnh trước khi quét!' });
    }
  };

  // Upload và quét barcode từ ảnh
  const handleUploadImage = () => {
    if (buttonBusy || processingUpload) {
      console.log('[Upload] Button busy, ignoring click');
      return;
    }
    
    try {
      console.log('[Upload] Opening file picker...');
      setButtonBusy(true);
      fileInputRef.current?.click();
      // Release button after a short delay
      setTimeout(() => setButtonBusy(false), 500);
    } catch (err) {
      console.error('[Upload] Error opening file picker:', err);
      setError('Không thể mở chọn ảnh. Vui lòng thử lại.');
      setButtonBusy(false);
    }
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
    if (loading || buttonBusy) {
      console.log('[Submit] Already processing, ignoring click');
      return;
    }

    try {
      console.log('[Submit] Creating activation...');
      setLoading(true);
      setButtonBusy(true);
      setError(null);

      const result = await api.createActivation({
        barcode: barcode.trim(),
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        dealerCode: dealerCode || undefined,
      });
      
      console.log('[Submit] Success:', result);
      setLastActivation(result);
      navigate('/result');
    } catch (err) {
      const apiErr = err as ApiError;
      console.error('[Submit] Activation error:', apiErr);
      
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
      setButtonBusy(false);
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
              onTouchStart={(e) => {
                // Touch feedback for mobile
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              disabled={showCamera || processingUpload || buttonBusy}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all active:scale-95"
              style={{
                background: (showCamera || processingUpload || buttonBusy)
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                boxShadow: (showCamera || processingUpload || buttonBusy) ? 'none' : '0 4px 10px rgba(37,99,235,0.3)',
                cursor: (showCamera || processingUpload || buttonBusy) ? 'not-allowed' : 'pointer',
              }}
              title="Chụp ảnh barcode"
            >
              {buttonBusy && !showCamera ? <Spinner /> : <Icon icon="zi-camera" />}
            </button>
            {/* Upload */}
            <button
              onClick={handleUploadImage}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              disabled={showCamera || processingUpload || buttonBusy}
              className="w-11 h-11 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all active:scale-95"
              style={{
                cursor: (showCamera || processingUpload || buttonBusy) ? 'not-allowed' : 'pointer',
                opacity: (showCamera || processingUpload || buttonBusy) ? 0.5 : 1,
              }}
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
          onTouchStart={(e) => {
            if (!loading && !buttonBusy) {
              e.currentTarget.style.transform = 'scale(0.98)';
            }
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          disabled={loading || buttonBusy}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
          style={{
            background: (loading || buttonBusy)
              ? '#93c5fd'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
            boxShadow: (loading || buttonBusy) ? 'none' : '0 6px 20px rgba(37,99,235,0.4)',
            cursor: (loading || buttonBusy) ? 'not-allowed' : 'pointer',
          }}
        >
          {(loading || buttonBusy)
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

      {/* Camera Modal + Error Modal Wrapper */}
      <>
        {/* ── Camera Popup Modal ── */}
        {showCamera && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={handleStopScan}
        >
          <div
            className="bg-white rounded-2xl w-[92%] max-w-md overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex-1">
                <span className="font-semibold text-gray-800 text-sm block">
                  {(capturedPhoto || uploadedPhoto) ? '🔍 Xem ảnh' : '📷 Quét barcode'}
                </span>
                {!capturedPhoto && !uploadedPhoto && autoScanEnabled && (
                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                    Auto-scan hoạt động
                  </span>
                )}
              </div>
              <button
                onClick={handleStopScan}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-xs active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* Toast notification */}
            {scanToast && (
              <div
                className={`mx-3 mt-2 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                  scanToast.type === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : scanToast.type === 'warning'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
                }`}
              >
                <span className="flex-shrink-0">
                  {scanToast.type === 'error' ? '❌' : scanToast.type === 'warning' ? '⚠️' : '✅'}
                </span>
                <span className="flex-1 leading-tight">{scanToast.message}</span>
              </div>
            )}

            {/* Camera / photo view */}
            <div className="px-3 pt-3">
              <div
                className="relative rounded-xl overflow-hidden bg-black"
                style={{ aspectRatio: '4/3' }}
              >
                {(capturedPhoto || uploadedPhoto) ? (
                  <img
                    src={capturedPhoto || uploadedPhoto || ''}
                    alt="Barcode preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={cssZoom ? {
                        transform: 'scale(2)',
                        transformOrigin: 'center center',
                      } : undefined}
                    />
                    
                    {/* Scanning line animation */}
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-b from-green-400 via-green-300 to-transparent"
                      style={{
                        top: '30%',
                        animation: 'scanLine 2s ease-in-out infinite',
                        boxShadow: '0 0 15px rgba(74,222,128,0.8)',
                      }}
                    />
                    
                    {/* Focus corner */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className="relative"
                        style={{
                          width: '70%',
                          height: '50%',
                          border: '2px solid rgba(74,222,128,0.6)',
                          borderRadius: '12px',
                          animation: 'focusPulse 1.5s ease-in-out infinite',
                        }}
                      >
                        {/* Corner accents */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <style>{`
                @keyframes scanLine {
                  0% { top: 10%; opacity: 0.8; }
                  50% { top: 80%; opacity: 1; }
                  100% { top: 10%; opacity: 0.8; }
                }
                @keyframes focusPulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.3); }
                  50% { box-shadow: 0 0 8px 3px rgba(74,222,128,0.15); }
                }
              `}</style>
            </div>

            {/* Action buttons */}
            <div className="px-3 py-3">
              {(capturedPhoto || uploadedPhoto) ? (
                <div className="flex gap-2">
                  {capturedPhoto ? (
                    <button
                      onClick={() => {
                        if (buttonBusy) return;
                        setButtonBusy(true);
                        setCapturedPhoto(null);
                        setTimeout(() => {
                          openCameraWithAutoScan();
                          setButtonBusy(false);
                        }, 100);
                      }}
                      onTouchStart={(e) => !buttonBusy && (e.currentTarget.style.transform = 'scale(0.95)')}
                      onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      disabled={buttonBusy}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors active:scale-95"
                      style={{
                        opacity: buttonBusy ? 0.5 : 1,
                        cursor: buttonBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      📷 Chụp lại
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleUploadImage}
                        onTouchStart={(e) => !buttonBusy && (e.currentTarget.style.transform = 'scale(0.95)')}
                        onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        disabled={buttonBusy}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors active:scale-95"
                        style={{
                          opacity: buttonBusy ? 0.5 : 1,
                          cursor: buttonBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        🖼 Ảnh khác
                      </button>
                      <button
                        onClick={() => {
                          if (buttonBusy) return;
                          setButtonBusy(true);
                          setUploadedPhoto(null);
                          setTimeout(() => {
                            openCameraWithAutoScan();
                            setButtonBusy(false);
                          }, 100);
                        }}
                        onTouchStart={(e) => !buttonBusy && (e.currentTarget.style.transform = 'scale(0.95)')}
                        onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        disabled={buttonBusy}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors active:scale-95"
                        style={{
                          opacity: buttonBusy ? 0.5 : 1,
                          cursor: buttonBusy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        📷 Chụp mới
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleScanFromPhoto}
                    onTouchStart={(e) => !scanningPhoto && (e.currentTarget.style.transform = 'scale(0.95)')}
                    onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    disabled={scanningPhoto || buttonBusy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{
                      background: (scanningPhoto || buttonBusy)
                        ? '#4ade80'
                        : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      boxShadow: (scanningPhoto || buttonBusy) ? '0 2px 8px rgba(74,222,128,0.2)' : '0 4px 12px rgba(22,163,74,0.3)',
                      cursor: (scanningPhoto || buttonBusy) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {(scanningPhoto || buttonBusy) ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="inline-block">🔍</span>
                        <span className="animate-pulse">Đang quét…</span>
                      </span>
                    ) : (
                      '🔍 Quét'
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleStopScan}
                    onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors active:scale-95"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleUploadImage}
                    onTouchStart={(e) => !buttonBusy && (e.currentTarget.style.transform = 'scale(0.95)')}
                    onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    disabled={buttonBusy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors active:scale-95"
                    style={{
                      opacity: buttonBusy ? 0.5 : 1,
                      cursor: buttonBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🖼 Upload
                  </button>
                  <button
                    onClick={handleCapturePhoto}
                    onTouchStart={(e) => !buttonBusy && (e.currentTarget.style.transform = 'scale(0.95)')}
                    onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    disabled={buttonBusy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{
                      background: buttonBusy ? '#4ade80' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      boxShadow: buttonBusy ? '0 2px 8px rgba(74,222,128,0.2)' : '0 4px 12px rgba(22,163,74,0.3)',
                      cursor: buttonBusy ? 'not-allowed' : 'pointer',
                      opacity: buttonBusy ? 0.7 : 1,
                    }}
                  >
                    {buttonBusy ? 'Đang xử lý...' : '📷 Chụp'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Modal - Prominent popup for scan failures */}
      {errorModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[9999]"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={() => setErrorModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200"
            style={{ maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-4xl">
                {errorModal.title.includes('Barcode') ? '🔍' : '⚠️'}
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-gray-800">{errorModal.title}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {errorModal.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setErrorModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors active:scale-95"
              >
                ✕ Đóng
              </button>
              <button
                onClick={() => {
                  setErrorModal(null);
                  if (errorModal.action.includes('Chụp')) {
                    // Reset and go back to camera preview
                    setCapturedPhoto(null);
                    setUploadedPhoto(null);
                    setShowCamera(true);
                  } else if (errorModal.action.includes('ảnh')) {
                    // Reset and open upload dialog
                    setCapturedPhoto(null);
                    setUploadedPhoto(null);
                    fileInputRef.current?.click();
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors active:scale-95"
              >
                {errorModal.action.includes('Chụp') ? '📷 Chụp mới' : errorModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
      </>

    </Page>
  );
}

export default EarnPointsPage;
