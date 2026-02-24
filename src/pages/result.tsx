// ===== Screen 3: Result =====

import React from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Text, Page, Icon } from 'zmp-ui';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  dealerInfoAtom,
  lastActivationAtom,
  dealerCodeAtom,
} from '@/store/app-store';

function ResultPage() {
  const navigate = useNavigate();
  const lastActivation = useAtomValue(lastActivationAtom);
  const dealerInfo = useAtomValue(dealerInfoAtom);
  const dealerCode = useAtomValue(dealerCodeAtom);
  const setLastActivation = useSetAtom(lastActivationAtom);

  if (!lastActivation) {
    return (
      <Page className="p-4 bg-white min-h-screen flex flex-col items-center justify-center">
        <Text className="text-gray-400">Chưa có giao dịch nào</Text>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Về trang chủ
        </Button>
      </Page>
    );
  }

  const handleContinue = () => {
    setLastActivation(null);
    navigate('/earn-points');
  };

  const handleGoHome = () => {
    setLastActivation(null);
    navigate('/');
  };

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-6">
        {/* Success icon */}
        <Box textAlign="center" className="pt-12">
          <Box className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <Text className="text-4xl">✅</Text>
          </Box>
          <Text.Title size="large" className="text-green-600">
            Tích điểm thành công!
          </Text.Title>
        </Box>

        {/* Product info */}
        <Box className="bg-gray-50 rounded-xl p-4 space-y-2 border">
          <Text size="xSmall" className="text-gray-500">Sản phẩm kích hoạt</Text>
          <Text size="normal" bold>{lastActivation.product.name}</Text>
          <Text size="xSmall" className="text-gray-400">SKU: {lastActivation.product.sku}</Text>
        </Box>

        {/* Customer points */}
        <Box className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <Box className="flex justify-between items-center">
            <Box>
              <Text size="xSmall" className="text-blue-500">Khách hàng</Text>
              <Text size="normal" bold className="text-blue-700">+1 điểm</Text>
            </Box>
            <Box textAlign="right">
              <Text size="xSmall" className="text-gray-400">Tổng điểm</Text>
              <Text.Title size="large" className="text-blue-700">
                {lastActivation.customerPointsAfter}
              </Text.Title>
            </Box>
          </Box>
        </Box>

        {/* Dealer points */}
        {lastActivation.dealerPointsAfter !== null && dealerInfo && (
          <Box className="bg-green-50 rounded-xl p-4 border border-green-200">
            <Box className="flex justify-between items-center">
              <Box>
                <Text size="xSmall" className="text-green-500">
                  Đại lý: {dealerInfo.shopName}
                </Text>
                <Text size="normal" bold className="text-green-700">+1 điểm</Text>
              </Box>
              <Box textAlign="right">
                <Text size="xSmall" className="text-gray-400">Tổng điểm</Text>
                <Text.Title size="large" className="text-green-700">
                  {lastActivation.dealerPointsAfter}
                </Text.Title>
              </Box>
            </Box>
          </Box>
        )}

        {/* Actions */}
        <Box className="space-y-3 pt-4">
          <Button
            variant="primary"
            fullWidth
            onClick={handleContinue}
            size="large"
          >
            Tích điểm tiếp {dealerCode ? `(${dealerCode})` : ''}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleGoHome}
          >
            Về trang chủ
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default ResultPage;
