// ===== Screen 2: Earn Points — v2 (Barcode Scan + Customer Info) =====
// • Auto-fill customer info when logged in as CUSTOMER
// • Camera button opens full-screen scanner (/scan-barcode)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'zmp-ui';
import { Page, Spinner, Icon } from 'zmp-ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  dealerCodeAtom,
  dealerInfoAtom,
  lastActivationAtom,
  customerNameAtom,
  customerPhoneAtom,
  authUserAtom,
} from '@/store/app-store';
import { api } from '@/services/api-client';
import {
  isValidBarcode,
  isValidPhone,
} from '@/services/scanner-enhanced';
import type { ApiError } from '@/types';

function EarnPointsPage() {
  const navigate = useNavigate();
  const dealerCode = useAtomValue(dealerCodeAtom);
  const dealerInfo = useAtomValue(dealerInfoAtom);
  const authUser = useAtomValue(authUserAtom);
  const setLastActivation = useSetAtom(lastActivationAtom);
  const [customerName, setCustomerName] = useAtom(customerNameAtom);
  const [customerPhone, setCustomerPhone] = useAtom(customerPhoneAtom);

  const isLoggedInCustomer = authUser?.role === 'CUSTOMER';

  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auto-fill customer info from logged-in user
  useEffect(() => {
    if (isLoggedInCustomer && authUser) {
      const name = authUser.customer?.name || authUser.fullName || '';
      const phone = authUser.customer?.phone || authUser.phone || '';
      if (name && !customerName) setCustomerName(name);
      if (phone && !customerPhone) setCustomerPhone(phone);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedInCustomer]);

  // Pick up barcode result returned from full-screen scanner
  useEffect(() => {
    const scanResult = sessionStorage.getItem('scanResult');
    if (scanResult && isValidBarcode(scanResult)) {
      setBarcode(scanResult);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.barcode;
        return next;
      });
      sessionStorage.removeItem('scanResult');
    }
  }, []);

  // Validate barcode format
  const handleBarcodeCheck = (bc: string) => {
    if (!bc || !isValidBarcode(bc)) {
      setFieldErrors((prev) => ({ ...prev, barcode: 'Barcode không hợp lệ. Cần mã Natri Ion hoặc numeric 8-20 chữ số' }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.barcode;
      return next;
    });
  };

  // Navigate to full-screen barcode scanner
  const handleScan = () => navigate('/scan-barcode');

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!barcode.trim()) errors.barcode = 'Vui lòng nhập barcode';
    else if (!isValidBarcode(barcode)) errors.barcode = 'Barcode không hợp lệ. Cần mã Natri Ion (12N5L, 12N7L, YTX4A, YTX5A, YTX7A) hoặc numeric 8-20 chữ số';

    if (!isLoggedInCustomer) {
      if (!customerName.trim() || customerName.trim().length < 2) errors.name = 'Tên ít nhất 2 ký tự';
      if (!isValidPhone(customerPhone)) errors.phone = 'SĐT không hợp lệ (VD: 0901234567)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

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
        setError('✅ Barcode đã được tích điểm trước đó!');
      } else if (apiErr.statusCode === 404) {
        setError('❌ Không tìm thấy: ' + (apiErr.message || 'Dealer không tồn tại'));
      } else if (apiErr.statusCode === 400) {
        setError('❌ ' + (apiErr.message || 'Dữ liệu không hợp lệ'));
      } else {
        setError('❌ Lỗi: ' + (apiErr.message || 'Lỗi hệ thống, vui lòng thử lại'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #eff6ff 0%, #f0fdf4 60%, #fafafa 100%)' }}
    >
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">

        {/* ── Hero header ── */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          >
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Tích điểm sản phẩm</h1>
          {dealerInfo && (
            <p className="text-xs text-gray-500">
              Đại lý:{' '}
              <span className="font-semibold text-blue-600">
                {dealerInfo.shopName} ({dealerInfo.code})
              </span>
            </p>
          )}
        </div>

        {/* ── Barcode section ── */}
        <div
          className="rounded-2xl bg-white p-4 space-y-3"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="text-base">🔖</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm">Barcode sản phẩm</span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Nhập hoặc quét barcode…"
                value={barcode}
                maxLength={40}
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            {/* Camera button — opens full-screen scanner */}
            <button
              onClick={handleScan}
              onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              disabled={loading}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all active:scale-95"
              style={{
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                boxShadow: loading ? 'none' : '0 4px 10px rgba(37,99,235,0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              title="Quét barcode toàn màn hình"
            >
              <Icon icon="zi-camera" />
            </button>
          </div>

          {fieldErrors.barcode && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <span>⚠️</span> {fieldErrors.barcode}
            </p>
          )}

          {barcode && !fieldErrors.barcode && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
              <span className="text-green-500 text-base">✅</span>
              <p className="text-xs text-green-700 font-medium">Barcode hợp lệ - sẵn sàng tích điểm</p>
            </div>
          )}
        </div>

        {/* ── Customer info section ── */}
        <div
          className="rounded-2xl bg-white p-4 space-y-3"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="text-base">👤</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm">Thông tin khách hàng</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Họ và tên
                {isLoggedInCustomer && <span className="text-blue-500 ml-1">✓</span>}
              </label>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={customerName}
                maxLength={100}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.name;
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Số điện thoại
                {isLoggedInCustomer && <span className="text-blue-500 ml-1">✓</span>}
              </label>
              <input
                type="tel"
                placeholder="0901234567"
                value={customerPhone}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setCustomerPhone(val);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.phone;
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {fieldErrors.phone && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {fieldErrors.phone}
                </p>
              )}
            </div>

            {isLoggedInCustomer && (
              <p className="text-xs text-blue-500 flex items-center gap-1">
                <span>ℹ️</span> Thông tin từ tài khoản đã đăng nhập. Bạn có thể thay đổi nếu cần
              </p>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-2">
            <span className="text-red-400 flex-shrink-0">⚠️</span>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ── Submit button ── */}
        <button
          onClick={handleSubmit}
          onTouchStart={(e) => {
            if (!loading) e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
          style={{
            background: loading
              ? '#93c5fd'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
            boxShadow: loading ? 'none' : '0 6px 20px rgba(37,99,235,0.4)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Spinner /> Đang xử lý…</span>
            : '⚡ Xác nhận tích điểm'
          }
        </button>

        {/* ── Back link ── */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    </Page>
  );
}

export default EarnPointsPage;
