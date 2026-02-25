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
  isValidBarcode,
  parseBarcodePrefix,
  SCANNER_VERSION,
  type ScannerError,
} from '@/services/scanner-enhanced';
import type { ApiError, BarcodeItemInfo } from '@/types';

const { Option } = Select;

type ScanState =
  | 'idle'           // Chưa bắt đầu quét
  | 'previewing'     // Camera preview, chưa chụp ảnh
  | 'captured'       // Đã chụp ảnh, chờ scan hoặc chụp lại
  | 'scanning'       // Camera đang mở, đang quét (continuous mode)
  | 'scanned'        // Đã quét được, hiển thị kết quả
  | 'saving'         // Đang gửi lên backend
  | 'saved'          // Lưu thành công
  | 'error';         // Lỗi (camera / API / format)

function BarcodeManagePage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  // Scan state
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [inferredProduct, setInferredProduct] = useState<{ sku: string; productName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState<ScannerError | 'API' | 'INVALID_FORMAT' | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
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

    // Wait for video element to render
    setTimeout(() => {
      if (!videoRef.current) {
        setScanState('error');
        setErrorType('UNKNOWN');
        setErrorMessage('Không thể khởi tạo video element.');
        return;
      }

      // Start camera preview (không scan liên tục)
      const cleanup = startCameraPreview(
        videoRef.current,
        // onError
        (errType, errMsg) => {
          setScanState('error');
          setErrorType(errType);
          setErrorMessage(errMsg);
        }
      );

      cleanupRef.current = cleanup;
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
    setScanState('idle');
  };

  // ── Quét lại ──
  const handleRescan = () => {
    handleStopScan();
    setTimeout(() => handleStartScan(), 200);
  };

  // ── Chụp ảnh từ camera preview ──
  const handleCapturePhoto = async () => {
    if (!videoRef.current) {
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage('Không thể chụp ảnh từ camera.');
      return;
    }

    try {
      const result = await captureAndDecode(videoRef.current);
      setCapturedPhoto(result.imageData);
      setScanState('captured');
      
      // Nếu tìm thấy barcode ngay khi chụp, auto-process
      if (result.barcode && isValidBarcode(result.barcode)) {
        setScannedBarcode(result.barcode);
        const parsed = parseBarcodePrefix(result.barcode);
        setInferredProduct(parsed);
        setScanState('scanned');
      }
    } catch (err) {
      console.error('Capture error:', err);
      setScanState('error');
      setErrorType('UNKNOWN');
      setErrorMessage('Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  // ── Quét barcode từ ảnh đã chụp hoặc upload ──
  const handleScanFromPhoto = async () => {
    if (capturedPhoto && videoRef.current) {
      // Scan from camera-captured photo
      setScanningPhoto(true);
      try {
        const result = await captureAndDecode(videoRef.current);
        if (result.barcode && isValidBarcode(result.barcode)) {
          setScannedBarcode(result.barcode);
          const parsed = parseBarcodePrefix(result.barcode);
          setInferredProduct(parsed);
          setScanState('scanned');
        } else {
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
      // Re-scan uploaded photo with enhanced processing
      setScanningPhoto(true);
      try {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              setScanState('error');
              setErrorType('UNKNOWN');
              setErrorMessage('Cannot create canvas context');
              setScanningPhoto(false);
              return;
            }

            // Try multiple processing approaches
            const attempts = [
              { scale: 1, enhance: false, label: 'original' },
              { scale: 0.8, enhance: false, label: 'scaled' },
              { scale: 1, enhance: true, label: 'enhanced' },
              { scale: 0.6, enhance: true, label: 'small enhanced' },
            ];

            let found = false;
            let debugInfo = `Re-scanning ${img.width}x${img.height}px image. `;
            
            for (const attempt of attempts) {
              if (found) break;
              
              canvas.width = Math.floor(img.width * attempt.scale);
              canvas.height = Math.floor(img.height * attempt.scale);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              if (attempt.enhance) {
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
                    setScannedBarcode(scannedCode);
                    const parsed = parseBarcodePrefix(scannedCode);
                    setInferredProduct(parsed);
                    setScanState('scanned');
                    found = true;
                    debugInfo += `Found with ${attempt.label} (${canvas.width}x${canvas.height}).`;
                    console.log('Re-scan success:', debugInfo);
                    break;
                  }
                }
              } catch {
                debugInfo += `Tried ${attempt.label}, `;
              }
            }

            if (!found) {
              setScanState('error');
              setErrorType('INVALID_FORMAT');
              setErrorMessage(`Không tìm thấy barcode hợp lệ. ${debugInfo} Hãy thử ảnh khác có barcode rõ nét hơn.`);
            }
          } catch (err) {
            console.error('Re-scan error:', err);
            setScanState('error');
            setErrorType('UNKNOWN');
            setErrorMessage('Lỗi khi quét lại ảnh. Vui lòng thử ảnh khác.');
          } finally {
            setScanningPhoto(false);
          }
        };
        img.onerror = () => {
          setScanState('error');
          setErrorType('UNKNOWN');
          setErrorMessage('Lỗi khi tải ảnh. Vui lòng thử lại.');
          setScanningPhoto(false);
        };
        img.src = uploadedPhoto;
      } catch (err) {
        console.error('Upload scan error:', err);
        setScanState('error');
        setErrorType('UNKNOWN');
        setErrorMessage('Lỗi khi quét ảnh upload. Vui lòng thử lại.');
        setScanningPhoto(false);
      }
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
              <Box className="relative rounded-lg overflow-hidden bg-black" style={{ minHeight: 240 }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    minHeight: 240,
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
              </Box>
              <Text size="xSmall" className="text-center text-gray-500">
                Đưa barcode vào khung và chụp ảnh
              </Text>
              <Box className="flex gap-2">
                <Button variant="secondary" onClick={handleStopScan} className="flex-1">
                  ✕ Hủy
                </Button>
                <Button variant="primary" onClick={handleCapturePhoto} className="flex-1">
                  📷 Chụp
                </Button>
              </Box>
            </Box>
          )}

          {/* === CAPTURED state — show captured image === */}
          {scanState === 'captured' && (capturedPhoto || uploadedPhoto) && (
            <Box className="space-y-3">
              <Box className="relative rounded-lg overflow-hidden bg-black" style={{ minHeight: 240 }}>
                <img
                  src={capturedPhoto || uploadedPhoto || ''}
                  alt={capturedPhoto ? "Captured barcode" : "Uploaded barcode"}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    minHeight: 240,
                  }}
                />
              </Box>
              <Text size="xSmall" className="text-center text-gray-600">
                {capturedPhoto ? 'Ảnh đã chụp từ camera.' : 'Ảnh đã tải lên.'} Nhấn "Quét" hoặc thử lại.
              </Text>
              <Box className="flex gap-2">
                {capturedPhoto ? (
                  // Nếu là ảnh chụp, chỉ cho phép chụp lại
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setCapturedPhoto(null);
                      setScanState('previewing');
                      // Restart camera preview
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
                        setUploadedPhoto(null);
                        setScanState('previewing');
                        // Restart camera preview
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
