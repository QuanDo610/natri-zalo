// ===== Login Page: OTP-based for Customer / Dealer =====

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Select } from 'zmp-ui';
import { useSetAtom } from 'jotai';
import { accessTokenAtom, refreshTokenAtom, authUserAtom } from '@/store/app-store';
import { api } from '@/services/api-client';
import type { ApiError, UserRole } from '@/types';

const { Option } = Select;

function LoginPage() {
  const navigate = useNavigate();
  const setAccessToken = useSetAtom(accessTokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'DEALER'>('CUSTOMER');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRequestOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await api.requestOtp(phone.trim());
      setStep('otp');
      setCountdown(300); // 5 minutes
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Không thể gửi OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await api.verifyOtp(phone.trim(), otp.trim(), role);
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      setAuthUser(result.user);

      // Navigate based on role
      if (result.user.role === 'DEALER') {
        navigate('/dealer-dashboard');
      } else {
        navigate('/customer-history');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Page className="p-4 bg-white min-h-screen">
      <Box className="space-y-6">
        {/* Header */}
        <Box textAlign="center" className="pt-8 pb-4">
          <Text.Title size="large" className="text-blue-600">
            Đăng nhập
          </Text.Title>
          <Text size="small" className="text-gray-500 mt-2">
            Đăng nhập bằng số điện thoại + OTP
          </Text>
        </Box>

        {/* Step 1: Phone + role */}
        {step === 'phone' && (
          <Box className="space-y-4">
            <Box className="space-y-2">
              <Text size="small" bold className="text-gray-700">
                Vai trò
              </Text>
              <Select
                value={role}
                onChange={(val) => setRole(val as 'CUSTOMER' | 'DEALER')}
                placeholder="Chọn vai trò"
              >
                <Option value="CUSTOMER" title="Khách hàng" />
                <Option value="DEALER" title="Đại lý" />
              </Select>
            </Box>

            <Box className="space-y-2">
              <Text size="small" bold className="text-gray-700">
                Số điện thoại
              </Text>
              <Input
                placeholder="VD: 0901234567"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                maxLength={10}
                type="tel"
              />
            </Box>

            {error && (
              <Text size="xSmall" className="text-red-500">
                {error}
              </Text>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={handleRequestOtp}
              loading={loading}
              disabled={phone.length < 10 || loading}
              size="large"
            >
              Gửi mã OTP
            </Button>
          </Box>
        )}

        {/* Step 2: OTP verification */}
        {step === 'otp' && (
          <Box className="space-y-4">
            <Box className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <Text size="xSmall" className="text-blue-700">
                Mã OTP đã gửi đến <Text size="small" bold inline>{phone}</Text>
              </Text>
              {countdown > 0 && (
                <Text size="xSmall" className="text-gray-500 mt-1">
                  Hết hạn sau: {formatCountdown(countdown)}
                </Text>
              )}
            </Box>

            <Box className="space-y-2">
              <Text size="small" bold className="text-gray-700">
                Nhập mã OTP
              </Text>
              <Input
                placeholder="6 chữ số"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                maxLength={6}
                type="tel"
              />
            </Box>

            {error && (
              <Text size="xSmall" className="text-red-500">
                {error}
              </Text>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={handleVerifyOtp}
              loading={loading}
              disabled={otp.length < 6 || loading}
              size="large"
            >
              Xác nhận
            </Button>

            <Box className="flex gap-2">
              <Button
                variant="tertiary"
                fullWidth
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError(null);
                }}
              >
                Đổi SĐT
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={handleRequestOtp}
                disabled={countdown > 240} // Can resend after 60s
                loading={loading}
              >
                Gửi lại OTP
              </Button>
            </Box>
          </Box>
        )}

        {/* Back to home */}
        <Box className="pt-2">
          <Button
            variant="tertiary"
            fullWidth
            onClick={() => navigate('/')}
          >
            ← Quay lại trang chủ
          </Button>
        </Box>
      </Box>
    </Page>
  );
}

export default LoginPage;
