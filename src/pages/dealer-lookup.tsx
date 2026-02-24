// ===== Screen 1: Dealer Lookup =====

import React, { useState } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Spinner } from 'zmp-ui';
import { useSetAtom } from 'jotai';
import { dealerCodeAtom, dealerInfoAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import type { DealerInfo, ApiError } from '@/types';

function DealerLookupPage() {
  const navigate = useNavigate();
  const setDealerCode = useSetAtom(dealerCodeAtom);
  const setDealerInfo = useSetAtom(dealerInfoAtom);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealer, setDealer] = useState<DealerInfo | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setDealer(null);

    try {
      const result = await api.lookupDealer(code.trim().toUpperCase());
      setDealer(result);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Không tìm thấy mã đại lý');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (dealer) {
      setDealerCode(dealer.code);
      setDealerInfo(dealer);
    } else {
      setDealerCode(null);
      setDealerInfo(null);
    }
    navigate('/earn-points');
  };

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-6">
        {/* Header */}
        <Box textAlign="center" className="pt-8 pb-4">
          <Text.Title size="large" className="text-blue-600">
            Tích điểm Natri Ion
          </Text.Title>
          <Text size="small" className="text-gray-500 mt-2">
            Nhập mã đại lý (không bắt buộc)
          </Text>
        </Box>

        {/* Dealer code input */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Mã đại lý
          </Text>
          <Box className="flex gap-2">
            <Box className="flex-1">
              <Input
                placeholder="VD: DL001"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                maxLength={20}
              />
            </Box>
            <Button
              variant="secondary"
              onClick={handleLookup}
              loading={loading}
              disabled={!code.trim() || loading}
              className="whitespace-nowrap"
            >
              Kiểm tra
            </Button>
          </Box>
          {error && (
            <Text size="xSmall" className="text-red-500">
              {error}
            </Text>
          )}
        </Box>

        {/* Dealer info card */}
        {dealer && (
          <Box className="bg-blue-50 rounded-xl p-4 space-y-2 border border-blue-200">
            <Text size="small" bold className="text-blue-700">
              Thông tin đại lý
            </Text>
            <Box className="space-y-1">
              <Box className="flex justify-between">
                <Text size="xSmall" className="text-gray-500">Cửa hàng</Text>
                <Text size="small" bold>{dealer.shopName}</Text>
              </Box>
              <Box className="flex justify-between">
                <Text size="xSmall" className="text-gray-500">Tên đại lý</Text>
                <Text size="small">{dealer.name}</Text>
              </Box>
              <Box className="flex justify-between">
                <Text size="xSmall" className="text-gray-500">SĐT</Text>
                <Text size="small">{dealer.phone}</Text>
              </Box>
              <Box className="flex justify-between">
                <Text size="xSmall" className="text-gray-500">Địa chỉ</Text>
                <Text size="small">{dealer.address || '—'}</Text>
              </Box>
              <Box className="flex justify-between">
                <Text size="xSmall" className="text-gray-500">Điểm tích lũy</Text>
                <Text size="small" bold className="text-green-600">{dealer.points} điểm</Text>
              </Box>
            </Box>
          </Box>
        )}

        {/* Loading */}
        {loading && (
          <Box className="flex justify-center py-4">
            <Spinner />
          </Box>
        )}

        {/* Continue button */}
        <Box className="pt-4">
          <Button
            variant="primary"
            fullWidth
            onClick={handleContinue}
            size="large"
          >
            {dealer ? 'Tiếp tục với đại lý này' : 'Tiếp tục không có đại lý'}
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default DealerLookupPage;
