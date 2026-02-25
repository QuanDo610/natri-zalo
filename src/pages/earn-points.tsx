// ===== Screen 2: Earn Points (Barcode Scan + Customer Info) =====

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Spinner, Icon } from 'zmp-ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  dealerCodeAtom,
  dealerInfoAtom,
  lastActivationAtom,
  customerNameAtom,
  customerPhoneAtom,
} from '@/store/app-store';
import { api } from '@/services/api-client';
import { startScan, stopScan, startCameraPreview, captureAndDecode, decodeFromImageFile, isValidBarcode, isValidPhone, type ScannerError } from '@/services/scanner-enhanced';
import type { ApiError, ProductInfo } from '@/types';

function EarnPointsPage() {
  const navigate = useNavigate();
  const dealerCode = useAtomValue(dealerCodeAtom);
  const dealerInfo = useAtomValue(dealerInfoAtom);
  const setLastActivation = useSetAtom(lastActivationAtom);
  const [customerName, setCustomerName] = useAtom(customerNameAtom);
  const [customerPhone, setCustomerPhone] = useAtom(customerPhoneAtom);

  const [barcode, setBarcode] = useState('');
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
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

  // Look up product when barcode changes
  const handleBarcodeCheck = async (bc: string) => {
    if (!bc || !isValidBarcode(bc)) {
      setProductInfo(null);
      return;
    }
    try {
      const product = await api.findProductByBarcode(bc);
      setProductInfo(product);
      if (product.activated) {
        setFieldErrors((prev) => ({ ...prev, barcode: 'Barcode này đã được kích hoạt trước đó' }));
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.barcode;
          return next;
        });
      }
    } catch {
      setProductInfo(null);
    }
  };

  // ── Camera scanning ──
  const handleStartScan = () => {
    setShowCamera(true);
    setCapturedPhoto(null);
    setUploadedPhoto(null);
    setError(null);
    
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
    else if (!isValidBarcode(barcode)) errors.barcode = 'Barcode phải từ 8-20 chữ số';
    if (!customerName.trim() || customerName.trim().length < 2) errors.name = 'Tên ít nhất 2 ký tự';
    if (!isValidPhone(customerPhone)) errors.phone = 'SĐT không hợp lệ (VD: 0901234567)';
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
      if (apiErr.statusCode === 409) {
        setError('Barcode đã được kích hoạt trước đó!');
      } else if (apiErr.statusCode === 404) {
        setError('Mã đại lý không tồn tại!');
      } else if (apiErr.statusCode === 400) {
        setError(apiErr.message || 'Dữ liệu không hợp lệ');
      } else {
        setError('Lỗi hệ thống, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-5">
        {/* Header */}
        <Box textAlign="center" className="pt-4 pb-2">
          <Text.Title size="large" className="text-blue-600">
            Tích điểm
          </Text.Title>
          {dealerInfo && (
            <Text size="xSmall" className="text-gray-400 mt-1">
              Đại lý: {dealerInfo.shopName} ({dealerInfo.code})
            </Text>
          )}
        </Box>

        {/* Barcode section */}
        <Box className="space-y-2">
          <Text size="small" bold className="text-gray-700">
            Barcode sản phẩm
          </Text>
          <Box className="flex gap-2">
            <Box className="flex-1">
              <Input
                placeholder="Nhập barcode (VD: 12N5LN12345N250712345)"
                value={barcode}
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
                maxLength={40}
              />
            </Box>
            <Box className="flex gap-1">
              <Button
                variant="secondary"
                onClick={handleScan}
                disabled={showCamera || processingUpload}
                className="whitespace-nowrap"
                size="small"
              >
                <Icon icon="zi-camera" />
              </Button>
              <Button
                variant="secondary"
                onClick={handleUploadImage}
                disabled={showCamera || processingUpload}
                className="whitespace-nowrap"
                size="small"
              >
                {processingUpload ? <Spinner /> : <Icon icon="zi-photo" />}
              </Button>
            </Box>
          </Box>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {fieldErrors.barcode && (
            <Text size="xSmall" className="text-red-500">{fieldErrors.barcode}</Text>
          )}

          {/* Product info from barcode */}
          {productInfo && !productInfo.activated && (
            <Box className="bg-green-50 rounded-lg p-3 border border-green-200">
              <Text size="xSmall" className="text-green-700">
                Sản phẩm: <Text size="small" bold inline>{productInfo.name}</Text> ({productInfo.sku})
              </Text>
            </Box>
          )}
        </Box>

        {/* Customer info */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Thông tin khách hàng
          </Text>

          <Box className="space-y-1">
            <Input
              label="Họ tên"
              placeholder="Nguyễn Văn A"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }}
              maxLength={100}
            />
            {fieldErrors.name && (
              <Text size="xSmall" className="text-red-500">{fieldErrors.name}</Text>
            )}
          </Box>

          <Box className="space-y-1">
            <Input
              label="Số điện thoại"
              placeholder="0901234567"
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCustomerPhone(val);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.phone;
                  return next;
                });
              }}
              maxLength={10}
            />
            {fieldErrors.phone && (
              <Text size="xSmall" className="text-red-500">{fieldErrors.phone}</Text>
            )}
          </Box>
        </Box>

        {/* Error */}
        {error && (
          <Box className="bg-red-50 rounded-lg p-3 border border-red-200">
            <Text size="small" className="text-red-600">{error}</Text>
          </Box>
        )}

        {/* Submit */}
        <Box className="pt-2">
          <Button
            variant="primary"
            fullWidth
            onClick={handleSubmit}
            loading={loading}
            disabled={loading}
            size="large"
          >
            Xác nhận tích điểm
          </Button>
        </Box>

        {/* Back */}
        <Box textAlign="center">
          <Button
            variant="tertiary"
            size="small"
            onClick={() => navigate('/')}
          >
            ← Quay lại nhập mã đại lý
          </Button>
        </Box>
      </Box>

      {/* Camera Modal */}
      {showCamera && (
        <Box 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ zIndex: 9999 }}
        >
          <Box className="bg-white rounded-lg p-4 m-4 w-full max-w-sm">
            <Box className="space-y-3">
              <Box className="flex justify-between items-center">
                <Text size="small" bold>
                  {capturedPhoto ? 'Xem lại ảnh' : 'Chụp ảnh barcode'}
                </Text>
                <Button variant="tertiary" size="small" onClick={handleStopScan}>
                  ✕
                </Button>
              </Box>
              
              <Box className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                {capturedPhoto || uploadedPhoto ? (
                  // Hiển thị ảnh đã chụp hoặc upload
                  <img
                    src={capturedPhoto || uploadedPhoto || ''}
                    alt={capturedPhoto ? "Captured barcode" : "Uploaded barcode"}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  // Camera preview
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {/* Scan frame guide */}
                    <Box
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ pointerEvents: 'none' }}
                    >
                      <Box
                        style={{
                          width: '70%',
                          height: '40%',
                          border: '2px solid rgba(0, 255, 0, 0.8)',
                          borderRadius: 8,
                          background: 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </Box>
                  </>
                )}
              </Box>
              
              {capturedPhoto || uploadedPhoto ? (
                // Buttons cho ảnh đã chụp/upload
                <Box className="space-y-2">
                  <Text size="xSmall" className="text-center text-gray-600">
                    {capturedPhoto ? 'Ảnh đã chụp từ camera.' : 'Ảnh đã tải lên.'} Nhấn "Quét" hoặc thử lại.
                  </Text>
                  <Box className="flex gap-2">
                    {capturedPhoto ? (
                      // Nếu là ảnh chụp, cho phép chụp lại
                      <Button 
                        variant="secondary" 
                        size="small" 
                        onClick={() => {
                          setCapturedPhoto(null);
                          // Restart camera preview
                          setTimeout(() => {
                            if (videoRef.current) {
                              const cleanup = startCameraPreview(
                                videoRef.current,
                                (errType: ScannerError, errMsg: string) => {
                                  setShowCamera(false);
                                  setError(`Lỗi camera: ${errMsg}`);
                                }
                              );
                              cleanupRef.current = cleanup;
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
                          size="small" 
                          onClick={handleUploadImage}
                          className="flex-1"
                        >
                          🖼️ Chọn khác
                        </Button>
                        <Button 
                          variant="tertiary" 
                          size="small" 
                          onClick={() => {
                            setUploadedPhoto(null);
                            // Restart camera preview
                            setTimeout(() => {
                              if (videoRef.current) {
                                const cleanup = startCameraPreview(
                                  videoRef.current,
                                  (errType: ScannerError, errMsg: string) => {
                                    setShowCamera(false);
                                    if (errType === 'PERMISSION_DENIED') {
                                      setError('Quyền camera bị từ chối.');
                                    } else {
                                      setError(`Lỗi camera: ${errMsg}`);
                                    }
                                  }
                                );
                                cleanupRef.current = cleanup;
                              }
                            }, 100);
                          }}
                          className="flex-1"
                        >
                          📷 Chụp mới
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="primary" 
                      size="small" 
                      onClick={handleScanFromPhoto}
                      loading={scanningPhoto}
                      disabled={scanningPhoto}
                      className="flex-1"
                    >
                      {scanningPhoto ? <Spinner /> : '🔍 Quét'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                // Buttons cho camera preview
                <Box className="space-y-2">
                  <Text size="xSmall" className="text-center text-gray-500">
                    Đưa barcode vào khung hình và chụp ảnh
                  </Text>
                  <Box className="flex gap-2">
                    <Button variant="secondary" onClick={handleStopScan} className="flex-1">
                      Hủy
                    </Button>
                    <Button variant="primary" onClick={handleCapturePhoto} className="flex-1">
                      <Icon icon="zi-camera" /> Chụp
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

    </Page>
  );
}

export default EarnPointsPage;
