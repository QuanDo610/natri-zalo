// ===== Screen 2: Earn Points (Barcode Scan + Customer Info) =====

import React, { useState } from 'react';
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
import { scanBarcode, isValidBarcode, isValidPhone } from '@/services/scanner';
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
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const handleScan = async () => {
    setScanLoading(true);
    try {
      const result = await scanBarcode();
      if (result) {
        setBarcode(result);
        await handleBarcodeCheck(result);
      }
    } finally {
      setScanLoading(false);
    }
  };

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
                placeholder="Nhập barcode (VD: 8936000021)"
                value={barcode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setBarcode(val);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.barcode;
                    return next;
                  });
                }}
                onBlur={() => handleBarcodeCheck(barcode)}
                maxLength={20}
              />
            </Box>
            <Button
              variant="secondary"
              onClick={handleScan}
              loading={scanLoading}
              className="whitespace-nowrap"
            >
              <Icon icon="zi-camera" /> Quét
            </Button>
          </Box>
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
    </Page>
  );
}

export default EarnPointsPage;
