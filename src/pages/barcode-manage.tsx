// ===== Barcode Management: Full-Screen Scanner Only =====
// Simplified page - launches full-screen scanner for barcode capture

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Text, Page, Spinner, Select } from 'zmp-ui';
import { useAtomValue } from 'jotai';
import { authUserAtom, accessTokenAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import {
  isValidBarcode,
  parseBarcodePrefix,
} from '@/services/scanner-enhanced';
import type { ApiError, BarcodeItemInfo } from '@/types';

const { Option } = Select;

type ResultState = 'idle' | 'scanned' | 'saving' | 'saved' | 'error';


function BarcodeManagePage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  // Result state
  const [resultState, setResultState] = useState<ResultState>('idle');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [inferredProduct, setInferredProduct] = useState<{ sku: string; productName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // List state
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

  // ── Handle result from full-screen scanner ──
  useEffect(() => {
    const scanResult = sessionStorage.getItem('scanResult');
    if (scanResult) {
      console.log('[FullScreenScan] Received result:', scanResult);
      
      if (isValidBarcode(scanResult)) {
        setScannedBarcode(scanResult);
        const parsed = parseBarcodePrefix(scanResult);
        setInferredProduct(parsed);
        setResultState('scanned');
        
        // Clear from storage
        sessionStorage.removeItem('scanResult');
      }
    }
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

  // ── Launch full-screen scanner ──
  const handleScan = () => {
    setScannedBarcode('');
    setInferredProduct(null);
    setErrorMessage('');
    setSuccessMessage('');
    setResultState('idle');
    navigate('/scan-barcode');
  };

  // ── Save barcode ──
  const handleSave = async () => {
    if (!scannedBarcode || !inferredProduct) return;

    setResultState('saving');
    setErrorMessage('');

    try {
      await api.scanAddBarcode({ code: scannedBarcode });
      setResultState('saved');
      setSuccessMessage(
        `Đã lưu barcode ${scannedBarcode} → ${inferredProduct.productName}`,
      );
      // Refresh list
      fetchBarcodes();
      
      // Reset after 2 seconds
      setTimeout(() => {
        setScannedBarcode('');
        setInferredProduct(null);
        setSuccessMessage('');
        setResultState('idle');
      }, 2000);
    } catch (err) {
      const apiErr = err as ApiError;
      setResultState('error');

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

  // ── Scan again ──
  const handleRescan = () => {
    setScannedBarcode('');
    setInferredProduct(null);
    setErrorMessage('');
    setSuccessMessage('');
    setResultState('idle');
    handleScan();
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
        </Box>

        {/* ─ Scan section ─ */}
        <Box className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3">
          <Text size="small" bold className="text-blue-700 mb-2">
            Quét Barcode
          </Text>

          {/* === IDLE state === */}
          {resultState === 'idle' && (
            <Button 
              variant="primary" 
              fullWidth
              onClick={handleScan}
              style={{ 
                backgroundColor: '#059669',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              📷 Quét Barcode (Full-Screen)
            </Button>
          )}

          {/* === SCANNED state === */}
          {resultState === 'scanned' && inferredProduct && (
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
          {resultState === 'saving' && (
            <Box className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <Text size="small" className="text-blue-600">
                Đang lưu barcode...
              </Text>
            </Box>
          )}

          {/* === SAVED state === */}
          {resultState === 'saved' && (
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
          {resultState === 'error' && (
            <Box className="space-y-3">
              <Box className="bg-red-50 rounded-lg p-3 border border-red-300">
                <Text size="small" bold className="text-red-700">
                  ❌ Lỗi
                </Text>
                <Text size="xSmall" className="text-red-600">
                  {errorMessage}
                </Text>
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
