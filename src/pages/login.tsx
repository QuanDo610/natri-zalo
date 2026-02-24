// ===== Login Page v3: 4 roles — OTP for customer/dealer, password for staff/admin =====

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Box, Button, Input, Text, Page, Select } from 'zmp-ui';
import { useSetAtom } from 'jotai';
import { accessTokenAtom, refreshTokenAtom, authUserAtom } from '@/store/app-store';
import { api, setApiAccessToken } from '@/services/api-client';
import type { ApiError, UserRole } from '@/types';

const { Option } = Select;

type LoginMethod = 'otp' | 'password';

function LoginPage() {
  const navigate = useNavigate();
  const setAccessToken = useSetAtom(accessTokenAtom);
  const setRefreshToken = useSetAtom(refreshTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);

  const [method, setMethod] = useState<LoginMethod>('otp');
  const [role, setRole] = useState<UserRole>('CUSTOMER');

  // OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [countdown, setCountdown] = useState(0);

  // Password state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-switch method based on role
  useEffect(() => {
    if (role === 'STAFF' || role === 'ADMIN') {
      setMethod('password');
    } else {
      setMethod('otp');
    }
    setError(null);
    setStep('input');
  }, [role]);

  const handleRequestOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.requestOtp(phone.trim());
      setStep('otp');
      setCountdown(300);
    } catch (err) {
      setError((err as ApiError).message || 'Không thể gửi OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const otpRole = role as 'CUSTOMER' | 'DEALER';
      const result = await api.verifyOtp(phone.trim(), otp.trim(), otpRole);
      onLoginSuccess(result.accessToken, result.refreshToken, result.user);
    } catch (err) {
      setError((err as ApiError).message || 'OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.loginStaff(username.trim(), password.trim());
      onLoginSuccess(result.accessToken, result.refreshToken, result.user);
    } catch (err) {
      setError((err as ApiError).message || 'Sai tài khoản hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const onLoginSuccess = (accessToken: string, refreshToken: string, user: any) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setAuthUser(user);
    setApiAccessToken(accessToken);

    // Navigate based on role
    switch (user.role) {
      case 'CUSTOMER':
        navigate('/customer-history');
        break;
      case 'DEALER':
        navigate('/dealer-dashboard');
        break;
      case 'STAFF':
        navigate('/staff-home');
        break;
      case 'ADMIN':
        navigate('/admin-home');
        break;
      default:
        navigate('/');
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
            Chọn vai trò và phương thức đăng nhập
          </Text>
        </Box>

        {/* Role selection */}
        <Box className="space-y-2">
          <Text size="small" bold className="text-gray-700">
            Vai trò
          </Text>
          <Select
            value={role}
            onChange={(val) => setRole(val as UserRole)}
            placeholder="Chọn vai trò"
          >
            <Option value="CUSTOMER" title="Khách hàng" />
            <Option value="DEALER" title="Đại lý" />
            <Option value="STAFF" title="Nhân viên" />
            <Option value="ADMIN" title="Quản trị viên" />
          </Select>
        </Box>

        {/* ── OTP Login ── */}
        {method === 'otp' && step === 'input' && (
          <Box className="space-y-4">
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
              <Text size="xSmall" className="text-red-500">{error}</Text>
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

        {method === 'otp' && step === 'otp' && (
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
              <Text size="xSmall" className="text-red-500">{error}</Text>
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
                  setStep('input');
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
                disabled={countdown > 240}
                loading={loading}
              >
                Gửi lại OTP
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Password Login (Staff / Admin) ── */}
        {method === 'password' && (
          <Box className="space-y-4">
            <Box className="space-y-2">
              <Text size="small" bold className="text-gray-700">
                Tên đăng nhập
              </Text>
              <Input
                placeholder="VD: admin, staff01"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
              />
            </Box>

            <Box className="space-y-2">
              <Text size="small" bold className="text-gray-700">
                Mật khẩu
              </Text>
              <Input
                placeholder="Nhập mật khẩu"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
            </Box>

            {error && (
              <Text size="xSmall" className="text-red-500">{error}</Text>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={handlePasswordLogin}
              loading={loading}
              disabled={!username.trim() || !password.trim() || loading}
              size="large"
            >
              Đăng nhập
            </Button>
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
