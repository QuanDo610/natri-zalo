// ===== Barcode Management: Scan camera + manual input + recent list =====

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Spinner, Select } from 'zmp-ui';
import { useAtomValue } from 'jotai';
import { authUserAtom, accessTokenAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import { scanBarcode, isValidBarcode } from '@/services/scanner';
import type { ApiError, BarcodeItemInfo, ProductItem } from '@/types';

const { Option } = Select;

function BarcodeManagePage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const token = useAtomValue(accessTokenAtom);

  // Add barcode state
  const [barcode, setBarcode] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Recent list state
  const [recentBarcodes, setRecentBarcodes] = useState<BarcodeItemInfo[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [filterSku, setFilterSku] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'UNUSED' | 'USED'>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Redirect if not staff/admin
  useEffect(() => {
    if (!authUser || !['STAFF', 'ADMIN'].includes(authUser.role)) {
      navigate('/login');
    }
  }, [authUser, navigate]);

  // Fetch products for dropdown
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const result = await api.getProducts();
        setProducts(result);
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    })();
  }, [token]);

  // Fetch recent barcodes
  const fetchBarcodes = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const result = await api.getBarcodes({
        sku: filterSku || undefined,
        status: filterStatus || undefined,
        q: searchQuery.trim() || undefined,
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
  }, [token, filterSku, filterStatus, searchQuery, page]);

  useEffect(() => {
    fetchBarcodes();
  }, [fetchBarcodes]);

  // ── Scan barcode via camera ──
  const handleScan = async () => {
    setScanLoading(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const result = await scanBarcode();
      if (result) {
        setBarcode(result);
      }
    } finally {
      setScanLoading(false);
    }
  };

  // ── Add barcode ──
  const handleAddBarcode = async () => {
    if (!barcode.trim() || !selectedSku) {
      setAddError('Vui lòng nhập barcode và chọn sản phẩm');
      return;
    }
    if (!isValidBarcode(barcode.trim())) {
      setAddError('Barcode phải từ 8-20 chữ số');
      return;
    }

    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      await api.createBarcode({ code: barcode.trim(), productSku: selectedSku });
      const product = products.find((p) => p.sku === selectedSku);
      setAddSuccess(`Đã thêm barcode ${barcode} → ${product?.name || selectedSku}`);
      setBarcode('');
      // Refresh list
      fetchBarcodes();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 409) {
        setAddError(`Barcode "${barcode}" đã tồn tại trong hệ thống!`);
      } else if (apiErr.statusCode === 404) {
        setAddError('Sản phẩm không tồn tại');
      } else if (apiErr.statusCode === 403) {
        setAddError('Bạn không có quyền thêm barcode');
      } else {
        setAddError(apiErr.message || 'Lỗi hệ thống');
      }
    } finally {
      setAddLoading(false);
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
            Quét bằng camera hoặc nhập thủ công
          </Text>
        </Box>

        {/* ─ Add barcode section ─ */}
        <Box className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3">
          <Text size="small" bold className="text-blue-700">
            Thêm Barcode mới
          </Text>

          {/* Barcode input + scan button */}
          <Box className="flex gap-2">
            <Box className="flex-1">
              <Input
                placeholder="Nhập barcode (VD: 8936000051)"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value.replace(/\D/g, ''));
                  setAddError(null);
                  setAddSuccess(null);
                }}
                maxLength={20}
              />
            </Box>
            <Button
              variant="secondary"
              onClick={handleScan}
              loading={scanLoading}
            >
              📷 Quét
            </Button>
          </Box>

          {/* Product SKU dropdown */}
          <Box className="space-y-1">
            <Text size="xSmall" className="text-gray-600">
              Chọn sản phẩm
            </Text>
            <Select
              value={selectedSku}
              onChange={(val) => setSelectedSku(val as string)}
              placeholder="Chọn SKU sản phẩm"
            >
              {products.map((p) => (
                <Option key={p.sku} value={p.sku} title={`${p.name} (${p.sku})`} />
              ))}
            </Select>
          </Box>

          {/* Success / Error */}
          {addError && (
            <Box className="bg-red-50 rounded-lg p-2 border border-red-200">
              <Text size="xSmall" className="text-red-600">{addError}</Text>
            </Box>
          )}
          {addSuccess && (
            <Box className="bg-green-50 rounded-lg p-2 border border-green-200">
              <Text size="xSmall" className="text-green-600">{addSuccess}</Text>
            </Box>
          )}

          {/* Add button */}
          <Button
            variant="primary"
            fullWidth
            onClick={handleAddBarcode}
            loading={addLoading}
            disabled={!barcode.trim() || !selectedSku || addLoading}
          >
            ➕ Thêm Barcode
          </Button>
        </Box>

        {/* ─ Recent barcodes list ─ */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Danh sách Barcode ({listTotal})
          </Text>

          {/* Filters */}
          <Box className="flex gap-2">
            <Box className="flex-1">
              <Input
                placeholder="Tìm barcode..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
              />
            </Box>
            <Select
              value={filterStatus}
              onChange={(val) => {
                setFilterStatus(val as '' | 'UNUSED' | 'USED');
                setPage(0);
              }}
              placeholder="Trạng thái"
              className="w-32"
            >
              <Option value="" title="Tất cả" />
              <Option value="UNUSED" title="Chưa dùng" />
              <Option value="USED" title="Đã dùng" />
            </Select>
          </Box>

          {/* SKU filter */}
          <Select
            value={filterSku}
            onChange={(val) => {
              setFilterSku(val as string);
              setPage(0);
            }}
            placeholder="Tất cả sản phẩm"
          >
            <Option value="" title="Tất cả sản phẩm" />
            {products.map((p) => (
              <Option key={p.sku} value={p.sku} title={`${p.name} (${p.sku})`} />
            ))}
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
