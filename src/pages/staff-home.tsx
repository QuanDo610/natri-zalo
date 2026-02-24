// ===== Staff Home: 2 tabs — Tích điểm + Quản lý Barcode =====

import React, { useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Text, Page } from 'zmp-ui';
import { useAtomValue, useSetAtom } from 'jotai';
import { authUserAtom, accessTokenAtom, refreshTokenAtom } from '@/store/app-store';
import { setApiAccessToken } from '@/services/api-client';

function StaffHomePage() {
  const navigate = useNavigate();
  const authUser = useAtomValue(authUserAtom);
  const setAccessToken = useSetAtom(accessTokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);

  useEffect(() => {
    if (!authUser || !['STAFF', 'ADMIN'].includes(authUser.role)) {
      navigate('/login');
    }
  }, [authUser, navigate]);

  const handleLogout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setAuthUser(null);
    setApiAccessToken(null);
    navigate('/');
  };

  if (!authUser) return null;

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-6">
        {/* Header */}
        <Box textAlign="center" className="pt-6 pb-2">
          <Text.Title size="large" className="text-blue-600">
            Trang nhân viên
          </Text.Title>
          <Text size="small" className="text-gray-500 mt-1">
            Xin chào, {authUser.fullName || authUser.username} ({authUser.role})
          </Text>
        </Box>

        {/* Main actions */}
        <Box className="space-y-3">
          <Text size="small" bold className="text-gray-700">
            Tính năng
          </Text>

          {/* Tích điểm */}
          <Button
            variant="primary"
            fullWidth
            size="large"
            onClick={() => navigate('/earn-points')}
            className="justify-start"
          >
            <Box className="flex items-center gap-3 w-full">
              <Text className="text-2xl">⭐</Text>
              <Box>
                <Text size="normal" bold className="text-white">Tích điểm</Text>
                <Text size="xSmall" className="text-blue-100">
                  Quét barcode → nhập KH → kích hoạt
                </Text>
              </Box>
            </Box>
          </Button>

          {/* Quản lý Barcode */}
          <Button
            variant="secondary"
            fullWidth
            size="large"
            onClick={() => navigate('/barcode-manage')}
            className="justify-start"
          >
            <Box className="flex items-center gap-3 w-full">
              <Text className="text-2xl">📦</Text>
              <Box>
                <Text size="normal" bold>Quản lý Barcode</Text>
                <Text size="xSmall" className="text-gray-500">
                  Quét bằng camera hoặc nhập thủ công
                </Text>
              </Box>
            </Box>
          </Button>
        </Box>

        {/* Quick stats placeholder */}
        <Box className="bg-gray-50 rounded-xl p-4 border space-y-2">
          <Text size="small" bold className="text-gray-700">
            Thống kê nhanh
          </Text>
          <Text size="xSmall" className="text-gray-400">
            Tính năng thống kê sẽ được cập nhật trong phiên bản tiếp theo.
          </Text>
        </Box>

        {/* Actions */}
        <Box className="space-y-2 pt-2">
          <Button variant="tertiary" fullWidth onClick={() => navigate('/')}>
            ← Về trang chủ
          </Button>
          <Button
            variant="tertiary"
            fullWidth
            onClick={handleLogout}
            className="text-red-500"
          >
            Đăng xuất
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default StaffHomePage;
