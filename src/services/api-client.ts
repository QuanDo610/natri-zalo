// ===== API Client for Natri Loyalty System (v3 — with auth, barcode mgmt, RBAC) =====

import type {
  DealerInfo,
  ProductInfo,
  ActivationRequest,
  ActivationResponse,
  CustomerInfo,
  LoginResponse,
  OtpRequestResponse,
  ActivationHistoryItem,
  PaginatedResponse,
  DealerStats,
  BarcodeItemInfo,
  CreateBarcodeRequest,
  CreateBarcodeResponse,
  BatchBarcodeResult,
  ProductItem,
  ScanAddBarcodeRequest,
  ScanAddBarcodeResponse,
} from '@/types';
import { mockApi } from '@/services/mock-service';

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';
const MOCK_MODE = (import.meta as any).env?.VITE_MOCK_MODE === 'true' || true; // default mock=true

// ── Token storage (in-memory, synced from Jotai) ──
let _accessToken: string | null = null;
export function setApiAccessToken(token: string | null) {
  _accessToken = token;
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw {
      statusCode: res.status,
      message: error.message || `HTTP ${res.status}`,
    };
  }

  return res.json();
}

// ===== Query string builder =====
function qs(params: Record<string, any>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ===== Real API =====
const realApi = {
  // ── Public ────────────────────────────────
  lookupDealer: (code: string): Promise<DealerInfo> =>
    request('GET', `/dealers/lookup?code=${encodeURIComponent(code)}`),

  findProductByBarcode: (barcode: string): Promise<ProductInfo> =>
    request('GET', `/products/by-barcode/${encodeURIComponent(barcode)}`),

  createActivation: (data: ActivationRequest): Promise<ActivationResponse> =>
    request('POST', '/activations', data),

  getCustomerByPhone: (phone: string): Promise<CustomerInfo> =>
    request('GET', `/customers/by-phone/${encodeURIComponent(phone)}`),

  // ── Auth: OTP ─────────────────────────────
  requestOtp: (phone: string): Promise<OtpRequestResponse> =>
    request('POST', '/auth/otp/request', { phone }),

  verifyOtp: (phone: string, code: string, role: 'CUSTOMER' | 'DEALER'): Promise<LoginResponse> =>
    request('POST', '/auth/otp/verify', { phone, code, role }),

  refreshToken: (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> =>
    request('POST', '/auth/refresh', { refreshToken }),

  logout: (refreshToken: string): Promise<{ message: string }> =>
    request('POST', '/auth/logout', { refreshToken }),

  // ── Auth: Staff / Admin ───────────────────
  loginStaff: (username: string, password: string): Promise<LoginResponse> =>
    request('POST', '/auth/login', { username, password }),

  // ── Me (customer profile + history) ───────
  getProfile: (): Promise<any> => request('GET', '/me'),

  getMyActivations: (params: {
    skip?: number;
    take?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<PaginatedResponse<ActivationHistoryItem>> =>
    request('GET', `/me/activations${qs(params)}`),

  // ── Dealer self-service (under /me/dealer/*) ──
  getDealerProfile: (): Promise<DealerInfo> => request('GET', '/me'),

  getDealerStats: (params?: { from?: string; to?: string }): Promise<DealerStats> =>
    request('GET', `/me/dealer/stats${qs(params || {})}`),

  getDealerActivations: (params: {
    skip?: number;
    take?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<PaginatedResponse<ActivationHistoryItem>> =>
    request('GET', `/me/dealer/activations${qs(params)}`),

  // ── Products ──────────────────────────────
  getProducts: (): Promise<ProductItem[]> =>
    request<{ data: ProductItem[] }>('GET', '/products?take=100').then((r) => r.data),

  // ── Barcode management (STAFF/ADMIN) ──────
  createBarcode: (data: CreateBarcodeRequest): Promise<CreateBarcodeResponse> =>
    request('POST', '/barcodes', data),

  /** POST /barcodes/scan-add — Camera scan: chỉ gửi code, backend tự parse prefix */
  scanAddBarcode: (data: ScanAddBarcodeRequest): Promise<ScanAddBarcodeResponse> =>
    request('POST', '/barcodes/scan-add', data),

  createBarcodeBatch: (
    items: { code: string; productSku: string }[],
  ): Promise<BatchBarcodeResult> =>
    request('POST', '/barcodes/batch', { items }),

  getBarcodes: (params: {
    sku?: string;
    status?: 'UNUSED' | 'USED';
    q?: string;
    skip?: number;
    take?: number;
  }): Promise<PaginatedResponse<BarcodeItemInfo>> =>
    request('GET', `/barcodes${qs(params)}`),
};

// ===== Exported API (switches between mock and real) =====
export const api = MOCK_MODE ? mockApi : realApi;
export default api;
